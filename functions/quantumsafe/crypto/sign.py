"""ML-DSA-65 (FIPS 204) digital signatures.

Backed by ``dilithium-py`` — a correct but non-constant-time reference
implementation.
"""

from __future__ import annotations

from typing import NamedTuple

from dilithium_py.ml_dsa import ML_DSA_65

ALG = "ML-DSA-65"
PK_LEN = 1952
SK_LEN = 4032


class SignKeypair(NamedTuple):
    pk: bytes
    sk: bytes


def sign_keygen() -> SignKeypair:
    pk, sk = ML_DSA_65.keygen()
    return SignKeypair(pk=pk, sk=sk)


def sign(sk: bytes, message: bytes, context: bytes = b"") -> bytes:
    return ML_DSA_65.sign(sk, message, ctx=context, deterministic=True)


def verify(pk: bytes, message: bytes, signature: bytes, context: bytes = b"") -> bool:
    try:
        return bool(ML_DSA_65.verify(pk, message, signature, ctx=context))
    except (ValueError, TypeError):
        return False
