import pytest

from quantumsafe.crypto.kdf import hkdf_sha256


def test_hkdf_is_deterministic_and_correct_length():
    out1 = hkdf_sha256(b"input-key-material", salt=b"s", info=b"i", length=32)
    out2 = hkdf_sha256(b"input-key-material", salt=b"s", info=b"i", length=32)
    assert out1 == out2
    assert len(out1) == 32


def test_hkdf_info_changes_output():
    a = hkdf_sha256(b"ikm", info=b"context-a")
    b = hkdf_sha256(b"ikm", info=b"context-b")
    assert a != b


def test_hkdf_custom_length():
    assert len(hkdf_sha256(b"ikm", length=16)) == 16
