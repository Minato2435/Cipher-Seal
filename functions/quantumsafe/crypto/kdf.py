"""HKDF-SHA256 key derivation. All symmetric keys in this project derive here."""

from __future__ import annotations

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def hkdf_sha256(
    ikm: bytes,
    *,
    salt: bytes = b"",
    info: bytes = b"",
    length: int = 32,
) -> bytes:
    """Derive ``length`` bytes from ``ikm`` using HKDF-SHA256."""
    return HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt,
        info=info,
    ).derive(ikm)
