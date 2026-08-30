import pytest

from quantumsafe.fb import identity, repo, sessions
from quantumsafe.fb.config import app_secret
from quantumsafe.fb.errors import AppError

SECRET = app_secret()


@pytest.fixture
def two_users(db):
    identity.provision_user(db, "alice", SECRET)
    identity.provision_user(db, "bob", SECRET)
    return "alice", "bob"


def test_establish_creates_session_and_event(db, two_users):
    alice, bob = two_users
    sid = sessions.establish_session(db, alice, bob, SECRET)

    doc = repo.get(db, "sessions", sid)
    assert set(doc["participants"]) == {"alice", "bob"}
    assert doc["state"] == "active"
    assert "sessionKey_enc" in doc and "iv_b64" in doc["sessionKey_enc"]

    evs = repo.query_recent_events(db, alice, 0.0)
    assert any(e["type"] == "SESSION_ESTABLISH" and e["meta"]["sessionId"] == sid for e in evs)


def test_both_participants_load_the_same_key(db, two_users):
    alice, bob = two_users
    sid = sessions.establish_session(db, alice, bob, SECRET)
    ka = sessions.load_session_key(db, sid, alice, SECRET)
    kb = sessions.load_session_key(db, sid, bob, SECRET)
    assert ka == kb and len(ka) == 32


def test_non_participant_rejected(db, two_users):
    alice, bob = two_users
    identity.provision_user(db, "carol", SECRET)
    sid = sessions.establish_session(db, alice, bob, SECRET)
    with pytest.raises(AppError) as ei:
        sessions.load_session_key(db, sid, "carol", SECRET)
    assert ei.value.code == "NOT_PARTICIPANT"


def test_peer_without_keys_rejected(db):
    identity.provision_user(db, "alice", SECRET)
    with pytest.raises(AppError) as ei:
        sessions.establish_session(db, "alice", "nobody", SECRET)
    assert ei.value.code == "PEER_NOT_READY"
