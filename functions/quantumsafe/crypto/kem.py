"""ML-KEM-768 (FIPS 203) key encapsulation.

Backed by ``kyber-py`` — a correct but non-constant-time reference
implementation. Suitable for a prototype, not for production key material.
"""

from __future__ import annotations

from typing import NamedTuple

from kyber_py.ml_kem import ML_KEM_768

ALG = "ML-KEM-768"
EK_LEN = 1184
DK_LEN = 2400
CT_LEN = 1088
SS_LEN = 32


class KemKeypair(NamedTuple):
    ek: bytes  # encapsulation (public) key
    dk: bytes  # decapsulation (private) key


def kem_keygen() -> KemKeypair:
    ek, dk = ML_KEM_768.keygen()
    return KemKeypair(ek=ek, dk=dk)


def kem_encapsulate(ek: bytes) -> tuple[bytes, bytes]:
    """Return ``(shared_secret, kem_ciphertext)``."""
    shared, ciphertext = ML_KEM_768.encaps(ek)
    return shared, ciphertext


def kem_decapsulate(dk: bytes, kem_ciphertext: bytes) -> bytes:
    """Return the shared secret recovered from ``kem_ciphertext``."""
    return ML_KEM_768.decaps(dk, kem_ciphertext)
