"""A single in-process run of the full secure-message path.

Used by tests and by the local demo to prove every primitive fits together. The
Cloud Functions layer will later perform these same steps across Firestore.
"""

from __future__ import annotations

import base64

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import kem_decapsulate, kem_encapsulate, kem_keygen
from quantumsafe.crypto.sign import sign, sign_keygen, verify

SESSION_INFO = b"quantumsafe-session-v1"
FINGERPRINT_INFO = b"quantumsafe-fp-v1"


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _fingerprint(key: bytes) -> str:
    """A short, non-invertible label for a session key (16 hex chars).

    Derived through HKDF rather than a truncated raw hash of the live key, so
    the published fingerprint is domain-separated from the key material itself.
    """
    return hkdf_sha256(key, info=FINGERPRINT_INFO, length=8).hex()


def secure_exchange(app_secret: bytes, plaintext: bytes) -> dict:
    """Run one full encrypt-sign-verify-decrypt exchange in a single process.

    ``app_secret`` is unused here and reserved for the Functions-layer keystore
    lookup (unwrapping the caller's stored private keys); this demo path mints
    ephemeral identities instead.

    WARNING: the returned dict contains ``recovered`` -- the *plaintext* -- for
    in-process demo and inspection only. Never persist, log, or transmit this
    dict.
    """
    # identities
    recipient_kem = kem_keygen()
    sender_sign = sign_keygen()

    # session key via ML-KEM + HKDF
    shared, kem_ct = kem_encapsulate(recipient_kem.ek)
    session_key = hkdf_sha256(shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)

    # sender encrypts + signs
    context = b"demo-session|sender|recipient"
    enc = aes256gcm_encrypt(session_key, plaintext, aad=context)
    signature = sign(
        sender_sign.sk,
        context + enc.iv + enc.ciphertext + enc.tag,
        context=context,
    )

    # recipient re-derives the key, verifies, decrypts
    r_shared = kem_decapsulate(recipient_kem.dk, kem_ct)
    r_key = hkdf_sha256(r_shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)
    ok = verify(
        sender_sign.pk,
        context + enc.iv + enc.ciphertext + enc.tag,
        signature,
        context=context,
    )
    recovered = aes256gcm_decrypt(r_key, enc.iv, enc.ciphertext, enc.tag, aad=context) if ok else b""

    return {
        "session_key_fp": _fingerprint(session_key),
        "iv_b64": _b64(enc.iv),
        "ct_b64": _b64(enc.ciphertext),
        "tag_b64": _b64(enc.tag),
        "sig_b64": _b64(signature),
        "verified": ok,
        "recovered": recovered,
    }
