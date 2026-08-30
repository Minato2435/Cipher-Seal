"""AES-256-GCM authenticated encryption.

``cryptography`` returns ciphertext with the 16-byte tag appended; this module
splits them so callers can store ``ciphertext`` and ``tag`` in separate fields.
"""

from __future__ import annotations

import os
from typing import NamedTuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LEN = 12
TAG_LEN = 16
KEY_LEN = 32


class AeadResult(NamedTuple):
    iv: bytes
    ciphertext: bytes
    tag: bytes


def _check_key(key: bytes) -> None:
    if len(key) != KEY_LEN:
        raise ValueError(f"AES-256-GCM requires a {KEY_LEN}-byte key, got {len(key)}")


def aes256gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = b"") -> AeadResult:
    _check_key(key)
    iv = os.urandom(IV_LEN)
    blob = AESGCM(key).encrypt(iv, plaintext, aad)
    return AeadResult(iv=iv, ciphertext=blob[:-TAG_LEN], tag=blob[-TAG_LEN:])


def aes256gcm_decrypt(
    key: bytes,
    iv: bytes,
    ciphertext: bytes,
    tag: bytes,
    aad: bytes = b"",
) -> bytes:
    _check_key(key)
    return AESGCM(key).decrypt(iv, ciphertext + tag, aad)
