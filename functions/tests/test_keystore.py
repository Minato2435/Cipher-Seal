import base64

import pytest

from quantumsafe.crypto.keystore import (
    derive_kek,
    generate_user_keys,
    unwrap_private_key,
    wrap_private_key,
)

SECRET = b"0123456789abcdef0123456789abcdef"
UID = "user-1"


def test_derive_kek_is_deterministic_per_salt():
    salt = b"user-salt"
    assert derive_kek(SECRET, salt) == derive_kek(SECRET, salt)
    assert len(derive_kek(SECRET, salt)) == 32


def test_derive_kek_varies_by_salt():
    assert derive_kek(SECRET, b"a") != derive_kek(SECRET, b"b")


def test_wrap_then_unwrap_round_trips():
    priv = b"\x01\x02\x03" * 40
    wrapped = wrap_private_key(SECRET, priv, alg="ML-KEM-768", uid=UID)
    assert set(wrapped) == {"alg", "salt_b64", "iv_b64", "ct_b64", "tag_b64"}
    assert wrapped["alg"] == "ML-KEM-768"
    # ciphertext must not contain the raw key
    assert base64.b64decode(wrapped["ct_b64"]) != priv
    assert unwrap_private_key(SECRET, wrapped, UID) == priv


def test_unwrap_with_wrong_secret_fails():
    wrapped = wrap_private_key(SECRET, b"secret-key-bytes", alg="ML-DSA-65", uid=UID)
    with pytest.raises(Exception):
        unwrap_private_key(b"wrong-secret-wrong-secret-wrong!", wrapped, UID)


def test_unwrap_with_wrong_uid_fails():
    # the AAD binds the blob to its owner: another user's uid must not open it
    wrapped = wrap_private_key(SECRET, b"secret-key-bytes", alg="ML-DSA-65", uid="a")
    assert unwrap_private_key(SECRET, wrapped, "a") == b"secret-key-bytes"
    with pytest.raises(Exception):
        unwrap_private_key(SECRET, wrapped, "b")


def test_generate_user_keys_shape_and_recoverability():
    material = generate_user_keys(SECRET, UID)
    pub = material["public"]
    priv = material["private"]
    assert pub["mlkemAlg"] == "ML-KEM-768"
    assert pub["mldsaAlg"] == "ML-DSA-65"
    # public keys are plain base64, private are wrapped dicts
    assert isinstance(pub["mlkemPub_b64"], str)
    assert set(priv["mlkemPriv_enc"]) == {"alg", "salt_b64", "iv_b64", "ct_b64", "tag_b64"}
    # the wrapped KEM private key still decapsulates against the public key
    from quantumsafe.crypto.kem import kem_decapsulate, kem_encapsulate

    ek = base64.b64decode(pub["mlkemPub_b64"])
    dk = unwrap_private_key(SECRET, priv["mlkemPriv_enc"], UID)
    shared, ct = kem_encapsulate(ek)
    assert kem_decapsulate(dk, ct) == shared
