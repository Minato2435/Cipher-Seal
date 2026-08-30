"""Send/receive: AES-256-GCM + ML-DSA over a session, ciphertext-only at rest."""

from __future__ import annotations

import base64

from cryptography.exceptions import InvalidTag

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.sign import ALG as SIGN_ALG
from quantumsafe.crypto.sign import sign, verify
from quantumsafe.fb import events, gating, identity, repo, sessions
from quantumsafe.fb.errors import (
    DECRYPT_FAILED,
    NOT_FOUND,
    NOT_PARTICIPANT,
    SIGNATURE_INVALID,
    AppError,
)
from quantumsafe.security.events import MSG_SENT, TAMPER


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text)


def _binding_context(session_id: str, sender_uid: str, recipient_uid: str) -> bytes:
    return f"{session_id}|{sender_uid}|{recipient_uid}".encode("ascii")


def send_message(db, session_id: str, sender_uid: str, plaintext: str, app_secret: bytes) -> str:
    session = repo.get(db, "sessions", session_id)
    if session is None:
        raise AppError(NOT_FOUND, f"session {session_id} not found")
    if sender_uid not in session["participants"]:
        raise AppError(NOT_PARTICIPANT, "not a participant of this session")
    recipient_uid = next(p for p in session["participants"] if p != sender_uid)

    gating.gate_user(db, sender_uid)  # blocked / high / elevated cannot send

    key = sessions.load_session_key(db, session_id, sender_uid, app_secret)
    ctx = _binding_context(session_id, sender_uid, recipient_uid)
    enc = aes256gcm_encrypt(key, plaintext.encode("utf-8"), aad=ctx)
    sk = identity.load_sign_secret(db, sender_uid, app_secret)
    signature = sign(sk, ctx + enc.iv + enc.ciphertext + enc.tag, context=ctx)

    mid = repo.add(
        db,
        "messages",
        {
            "sessionId": session_id,
            "senderUid": sender_uid,
            "recipientUid": recipient_uid,
            "iv_b64": _b64(enc.iv),
            "ct_b64": _b64(enc.ciphertext),
            "tag_b64": _b64(enc.tag),
            "sig_b64": _b64(signature),
            "sigAlg": SIGN_ALG,
            "verified": None,
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    events.record_event(db, sender_uid, MSG_SENT, {"size": len(plaintext), "recipient": recipient_uid})
    return mid


def read_message(db, message_id: str, reader_uid: str, app_secret: bytes) -> str:
    msg = repo.get(db, "messages", message_id)
    if msg is None:
        raise AppError(NOT_FOUND, f"message {message_id} not found")
    if reader_uid not in (msg["senderUid"], msg["recipientUid"]):
        raise AppError(NOT_PARTICIPANT, "not a participant of this message")

    ctx = _binding_context(msg["sessionId"], msg["senderUid"], msg["recipientUid"])
    iv, ct, tag = _unb64(msg["iv_b64"]), _unb64(msg["ct_b64"]), _unb64(msg["tag_b64"])
    sig = _unb64(msg["sig_b64"])
    sender_pk = identity.load_sign_public(db, msg["senderUid"])

    if not verify(sender_pk, ctx + iv + ct + tag, sig, context=ctx):
        repo.merge(db, "messages", message_id, {"verified": False})
        events.record_event(db, reader_uid, TAMPER, {"messageId": message_id})
        raise AppError(SIGNATURE_INVALID, "message signature failed verification")

    repo.merge(db, "messages", message_id, {"verified": True})
    # `require_active=False`: history stays readable after an escalation
    # terminated the session, so an admin can unblock and show the thread.
    key = sessions.load_session_key(
        db, msg["sessionId"], reader_uid, app_secret, require_active=False
    )
    try:
        plaintext = aes256gcm_decrypt(key, iv, ct, tag, aad=ctx)
    except InvalidTag as exc:
        raise AppError(DECRYPT_FAILED, "message could not be decrypted") from exc
    # No MSG_RECV event: no feature in ai.features consumes it, so recording one
    # only fired the risk trigger (a full rescore) on every message read.
    return plaintext.decode("utf-8")
