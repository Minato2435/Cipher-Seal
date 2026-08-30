import time

from quantumsafe.fb import repo


def test_set_get_merge_add(db):
    repo.set(db, "users", "u1", {"role": "user", "status": "normal"})
    assert repo.get(db, "users", "u1")["role"] == "user"

    repo.merge(db, "users", "u1", {"status": "elevated"})
    doc = repo.get(db, "users", "u1")
    assert doc["status"] == "elevated" and doc["role"] == "user"

    new_id = repo.add(db, "alerts", {"uid": "u1", "reason": "x"})
    assert isinstance(new_id, str) and repo.get(db, "alerts", new_id)["uid"] == "u1"

    assert repo.get(db, "users", "missing") is None


def test_query_recent_events_filters_by_uid_and_time(db):
    now = time.time()
    repo.add(db, "securityEvents", {"uid": "a", "type": "MSG_SENT", "meta": {}, "ts": _ts(now - 10)})
    repo.add(db, "securityEvents", {"uid": "a", "type": "LOGIN_FAIL", "meta": {}, "ts": _ts(now - 9999)})
    repo.add(db, "securityEvents", {"uid": "b", "type": "MSG_SENT", "meta": {}, "ts": _ts(now - 5)})

    rows = repo.query_recent_events(db, "a", now - 300)
    assert [r["type"] for r in rows] == ["MSG_SENT"]


def test_query_active_sessions_for(db):
    repo.add(db, "sessions", {"participants": ["a", "b"], "state": "active"})
    repo.add(db, "sessions", {"participants": ["a", "c"], "state": "terminated"})
    repo.add(db, "sessions", {"participants": ["x", "y"], "state": "active"})

    got = repo.query_active_sessions_for(db, "a")
    assert len(got) == 1 and set(got[0][1]["participants"]) == {"a", "b"}


def _ts(epoch: float):
    from datetime import datetime, timezone
    return datetime.fromtimestamp(epoch, tz=timezone.utc)
