from quantumsafe.crypto.sign import (
    ALG,
    PK_LEN,
    SK_LEN,
    sign,
    sign_keygen,
    verify,
)


def test_alg_label():
    assert ALG == "ML-DSA-65"


def test_keygen_sizes():
    kp = sign_keygen()
    assert len(kp.pk) == PK_LEN
    assert len(kp.sk) == SK_LEN


def test_sign_then_verify_true():
    kp = sign_keygen()
    sig = sign(kp.sk, b"message body", context=b"sid|a|b")
    assert verify(kp.pk, b"message body", sig, context=b"sid|a|b") is True


def test_flipped_message_byte_fails_verify():
    kp = sign_keygen()
    sig = sign(kp.sk, b"message body")
    assert verify(kp.pk, b"mess!ge body", sig) is False


def test_context_mismatch_fails_verify():
    kp = sign_keygen()
    sig = sign(kp.sk, b"body", context=b"ctx-1")
    assert verify(kp.pk, b"body", sig, context=b"ctx-2") is False


def test_wrong_public_key_fails_verify():
    signer = sign_keygen()
    other = sign_keygen()
    sig = sign(signer.sk, b"body")
    assert verify(other.pk, b"body", sig) is False
