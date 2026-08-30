import pytest

from quantumsafe.crypto.kem import kem_decapsulate, kem_encapsulate
from quantumsafe.crypto.sign import sign, verify
from quantumsafe.fb import identity, repo
from quantumsafe.fb.config import app_secret
from quantumsafe.fb.errors import AppError

SECRET = app_secret()


def test_provision_is_idempotent_and_writes_all_three_docs(db):
    assert identity.provision_user(db, "u1", SECRET, display_name="Ada", email="ada@x.com") is True
    assert identity.provision_user(db, "u1", SECRET) is False

    assert repo.get(db, "publicKeys", "u1")["mlkemAlg"] == "ML-KEM-768"
    priv = repo.get(db, "privateKeys", "u1")
    assert set(priv) == {"mlkemPriv_enc", "mldsaPriv_enc"}
    user = repo.get(db, "users", "u1")
    assert user["role"] == "user" and user["status"] == "normal" and user["displayName"] == "Ada"


def test_provision_does_not_downgrade_existing_role_or_status(db):
    identity.provision_user(db, "u1", SECRET)
    repo.merge(db, "users", "u1", {"role": "admin", "status": "elevated"})
    identity.provision_user(db, "u1", SECRET)  # no-op branch
    user = repo.get(db, "users", "u1")
    assert user["role"] == "admin" and user["status"] == "elevated"


def test_loaded_keys_actually_work(db):
    identity.provision_user(db, "alice", SECRET)
    ek = identity.load_kem_public(db, "alice")
    dk = identity.load_kem_secret(db, "alice", SECRET)
    shared, ct = kem_encapsulate(ek)
    assert kem_decapsulate(dk, ct) == shared

    sk = identity.load_sign_secret(db, "alice", SECRET)
    pk = identity.load_sign_public(db, "alice")
    sig = sign(sk, b"msg", context=b"ctx")
    assert verify(pk, b"msg", sig, context=b"ctx") is True


def test_missing_peer_raises_app_error(db):
    with pytest.raises(AppError) as ei:
        identity.load_kem_public(db, "ghost")
    assert ei.value.code == "PEER_NOT_READY"
