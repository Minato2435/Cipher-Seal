"""Per-conversation ML-KEM session establishment and key retrieval."""

from __future__ import annotations

import base64

from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import kem_encapsulate
from quantumsafe.crypto.keystore import unwrap_private_key, wrap_private_key
from quantumsafe.fb import events, identity, repo
from quantumsafe.fb.config import collection
from quantumsafe.fb.errors import NOT_FOUND, NOT_PARTICIPANT, SESSION_INACTIVE, AppError
from quantumsafe.security.events import SESSION_ESTABLISH

SESSION_INFO = b"quantumsafe-session-v1"
_SESSION_KEY_ALG = "AES-256-GCM"


def establish_session(db, caller_uid: str, peer_uid: str, app_secret: bytes) -> str:
    peer_ek = identity.load_kem_public(db, peer_uid)          # raises PEER_NOT_READY
    identity.load_kem_public(db, caller_uid)                  # caller must be provisioned too

    shared, kem_ct = kem_encapsulate(peer_ek)
    session_key = hkdf_sha256(shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)

    sid = repo.add(
        db,
        "sessions",
        {
            "participants": [caller_uid, peer_uid],
            "kemCtB64": base64.b64encode(kem_ct).decode("ascii"),
            "state": "active",
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    wrapped = wrap_private_key(app_secret, session_key, _SESSION_KEY_ALG, sid)
    db.collection(collection("sessions")).document(sid).update({"sessionKey_enc": wrapped})

    events.record_event(db, caller_uid, SESSION_ESTABLISH, {"peer": peer_uid, "sessionId": sid})
    return sid


def load_session_key(db, session_id: str, requester_uid: str, app_secret: bytes) -> bytes:
    doc = repo.get(db, "sessions", session_id)
    if doc is None:
        raise AppError(NOT_FOUND, f"session {session_id} not found")
    if requester_uid not in doc["participants"]:
        raise AppError(NOT_PARTICIPANT, "not a participant of this session")
    if doc.get("state") != "active":
        raise AppError(SESSION_INACTIVE, "session is not active")
    return unwrap_private_key(app_secret, doc["sessionKey_enc"], session_id)
