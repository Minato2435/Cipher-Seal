import time

import pytest

from quantumsafe.fb import events
from quantumsafe.security.events import MSG_SENT, SecurityEvent


def test_record_event_rejects_unknown_type(db):
    with pytest.raises(ValueError):
        events.record_event(db, "u1", "NOT_A_TYPE")


def test_record_then_load_window_round_trips(db):
    now = time.time()
    events.record_event(db, "u1", MSG_SENT, {"size": 12, "recipient": "u2"})
    events.record_event(db, "u1", "LOGIN_FAIL")
    events.record_event(db, "u2", MSG_SENT, {"size": 5})

    loaded = events.load_events_window(db, "u1", now + 5, 300.0)
    assert all(isinstance(e, SecurityEvent) for e in loaded)
    assert {e.type for e in loaded} == {"MSG_SENT", "LOGIN_FAIL"}
    sent = next(e for e in loaded if e.type == "MSG_SENT")
    assert sent.meta["size"] == 12 and sent.uid == "u1"
    assert now - 5 < sent.ts < now + 5


def test_load_window_excludes_old_events(db):
    now = time.time()
    eid = events.record_event(db, "u1", "LOGIN_FAIL")
    # backdate it directly
    from quantumsafe.fb.config import collection
    from datetime import datetime, timezone
    db.collection(collection("securityEvents")).document(eid).update(
        {"ts": datetime.fromtimestamp(now - 10_000, tz=timezone.utc)}
    )
    assert events.load_events_window(db, "u1", now, 300.0) == []
