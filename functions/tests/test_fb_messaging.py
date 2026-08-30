import base64

import pytest

from quantumsafe.fb import identity, messaging, repo, sessions
from quantumsafe.fb.config import app_secret, collection
from quantumsafe.fb.errors import AppError

SECRET = app_secret()


@pytest.fixture
def convo(db):
    identity.provision_user(db, "alice", SECRET)
    identity.provision_user(db, "bob", SECRET)
    sid = sessions.establish_session(db, "alice", "bob", SECRET)
    return sid


def test_send_stores_ciphertext_only_and_read_recovers_plaintext(db, convo):
    mid = messaging.send_message(db, convo, "alice", "meet at dawn", SECRET)
    doc = repo.get(db, "messages", mid)
    assert set(["iv_b64", "ct_b64", "tag_b64", "sig_b64"]).issubset(doc)
    assert "meet at dawn" not in str(doc)
    assert b"meet at dawn" not in base64.b64decode(doc["ct_b64"])
    assert doc["verified"] is None

    assert messaging.read_message(db, mid, "bob", SECRET) == "meet at dawn"
    assert repo.get(db, "messages", mid)["verified"] is True
    types = {e["type"] for e in repo.query_recent_events(db, "bob", 0.0)}
    assert "MSG_RECV" in types


def test_tampered_ciphertext_is_rejected_and_flagged(db, convo):
    mid = messaging.send_message(db, convo, "alice", "secret", SECRET)
    bad = base64.b64encode(b"\x00" + base64.b64decode(repo.get(db, "messages", mid)["ct_b64"])[1:]).decode()
    db.collection(collection("messages")).document(mid).update({"ct_b64": bad})

    with pytest.raises(AppError) as ei:
        messaging.read_message(db, mid, "bob", SECRET)
    assert ei.value.code == "SIGNATURE_INVALID"
    assert repo.get(db, "messages", mid)["verified"] is False
    assert any(e["type"] == "TAMPER" for e in repo.query_recent_events(db, "bob", 0.0))


def test_blocked_sender_cannot_send(db, convo):
    repo.merge(db, "users", "alice", {"status": "blocked"})
    with pytest.raises(AppError) as ei:
        messaging.send_message(db, convo, "alice", "hi", SECRET)
    assert ei.value.code == "ACCOUNT_BLOCKED"


def test_elevated_sender_needs_recent_reauth(db, convo):
    repo.merge(db, "users", "alice", {"status": "elevated"})
    with pytest.raises(AppError) as ei:
        messaging.send_message(db, convo, "alice", "hi", SECRET)
    assert ei.value.code == "REAUTH_REQUIRED"

    repo.merge(db, "users", "alice", {"reauthAt": repo.SERVER_TIMESTAMP})
    assert messaging.send_message(db, convo, "alice", "hi again", SECRET)


def test_non_participant_cannot_read(db, convo):
    identity.provision_user(db, "carol", SECRET)
    mid = messaging.send_message(db, convo, "alice", "x", SECRET)
    with pytest.raises(AppError) as ei:
        messaging.read_message(db, mid, "carol", SECRET)
    assert ei.value.code == "NOT_PARTICIPANT"
