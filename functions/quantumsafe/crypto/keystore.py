"""Generate per-user PQC keypairs and wrap private keys for storage at rest.

Private keys are sealed with AES-256-GCM under a KEK that is HKDF-derived from a
server-held ``app_secret`` and a random per-key salt. The GCM AAD binds each
blob to its algorithm *and* its owning ``uid``, so one user's sealed key cannot
be swapped into another user's record. Only the sealed form is ever returned
for storage.
"""

from __future__ import annotations

import base64
import os

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import ALG as KEM_ALG
from quantumsafe.crypto.kem import kem_keygen
from quantumsafe.crypto.sign import ALG as SIGN_ALG
from quantumsafe.crypto.sign import sign_keygen

KEK_INFO = b"quantumsafe-kek-v1"
_SALT_LEN = 16


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text)


def derive_kek(app_secret: bytes, salt: bytes) -> bytes:
    """Derive a 32-byte KEK from ``app_secret``.

    ``app_secret`` must be a high-entropy server-held secret: this is HKDF, an
    extract-and-expand KDF with no work factor, not a password KDF — never pass
    a passphrase.
    """
    return hkdf_sha256(app_secret, salt=salt, info=KEK_INFO, length=32)


def _aad(alg: str, uid: str) -> bytes:
    """Bind the sealed blob to both the algorithm and its owning user."""
    return f"{alg}|{uid}".encode("ascii")


def wrap_private_key(app_secret: bytes, private_key: bytes, alg: str, uid: str) -> dict:
    salt = os.urandom(_SALT_LEN)
    kek = derive_kek(app_secret, salt)
    enc = aes256gcm_encrypt(kek, private_key, aad=_aad(alg, uid))
    return {
        "alg": alg,
        "salt_b64": _b64(salt),
        "iv_b64": _b64(enc.iv),
        "ct_b64": _b64(enc.ciphertext),
        "tag_b64": _b64(enc.tag),
    }


def unwrap_private_key(app_secret: bytes, wrapped: dict, uid: str) -> bytes:
    kek = derive_kek(app_secret, _unb64(wrapped["salt_b64"]))
    return aes256gcm_decrypt(
        kek,
        _unb64(wrapped["iv_b64"]),
        _unb64(wrapped["ct_b64"]),
        _unb64(wrapped["tag_b64"]),
        aad=_aad(wrapped["alg"], uid),
    )


def generate_user_keys(app_secret: bytes, uid: str) -> dict:
    kem_kp = kem_keygen()
    sign_kp = sign_keygen()
    return {
        "public": {
            "mlkemPub_b64": _b64(kem_kp.ek),
            "mldsaPub_b64": _b64(sign_kp.pk),
            "mlkemAlg": KEM_ALG,
            "mldsaAlg": SIGN_ALG,
        },
        "private": {
            "mlkemPriv_enc": wrap_private_key(app_secret, kem_kp.dk, KEM_ALG, uid),
            "mldsaPriv_enc": wrap_private_key(app_secret, sign_kp.sk, SIGN_ALG, uid),
        },
    }
