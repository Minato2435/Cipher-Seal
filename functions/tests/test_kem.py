from quantumsafe.crypto.kem import (
    ALG,
    CT_LEN,
    DK_LEN,
    EK_LEN,
    SS_LEN,
    kem_decapsulate,
    kem_encapsulate,
    kem_keygen,
)


def test_alg_label():
    assert ALG == "ML-KEM-768"


def test_keygen_sizes():
    kp = kem_keygen()
    assert len(kp.ek) == EK_LEN
    assert len(kp.dk) == DK_LEN


def test_encaps_decaps_agree_on_shared_secret():
    kp = kem_keygen()
    shared, ct = kem_encapsulate(kp.ek)
    assert len(shared) == SS_LEN
    assert len(ct) == CT_LEN
    assert kem_decapsulate(kp.dk, ct) == shared


def test_wrong_decaps_key_yields_different_secret():
    a = kem_keygen()
    b = kem_keygen()
    shared, ct = kem_encapsulate(a.ek)
    # ML-KEM implicit rejection: decaps with the wrong key returns *a* value,
    # just not the encapsulated one.
    assert kem_decapsulate(b.dk, ct) != shared
