import pytest

from quantumsafe.crypto.aead import (
    IV_LEN,
    KEY_LEN,
    TAG_LEN,
    aes256gcm_decrypt,
    aes256gcm_encrypt,
)

KEY = bytes(range(32))


def test_round_trip_recovers_plaintext():
    enc = aes256gcm_encrypt(KEY, b"attack at dawn", aad=b"sid-1")
    assert len(enc.iv) == IV_LEN
    assert len(enc.tag) == TAG_LEN
    assert enc.ciphertext != b"attack at dawn"
    out = aes256gcm_decrypt(KEY, enc.iv, enc.ciphertext, enc.tag, aad=b"sid-1")
    assert out == b"attack at dawn"


def test_each_encryption_uses_a_fresh_iv():
    a = aes256gcm_encrypt(KEY, b"x")
    b = aes256gcm_encrypt(KEY, b"x")
    assert a.iv != b.iv


def test_tampered_ciphertext_fails():
    enc = aes256gcm_encrypt(KEY, b"hello")
    bad = bytes([enc.ciphertext[0] ^ 1]) + enc.ciphertext[1:]
    with pytest.raises(Exception):
        aes256gcm_decrypt(KEY, enc.iv, bad, enc.tag)


def test_wrong_aad_fails():
    enc = aes256gcm_encrypt(KEY, b"hello", aad=b"sid-1")
    with pytest.raises(Exception):
        aes256gcm_decrypt(KEY, enc.iv, enc.ciphertext, enc.tag, aad=b"sid-2")


def test_non_256_bit_key_rejected():
    with pytest.raises(ValueError):
        aes256gcm_encrypt(b"short", b"hello")
