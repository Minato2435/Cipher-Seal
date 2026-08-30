"""Security-event persistence: write to Firestore, read back as Part 1 objects."""

from __future__ import annotations

from datetime import datetime, timezone

from quantumsafe.fb import repo
from quantumsafe.security.events import VALID_TYPES, SecurityEvent

# Firestore SERVER_TIMESTAMP is stamped on Google's clock at commit time, which
# routinely runs a few hundred milliseconds ahead of this process's clock. A
# rescore that fires right after a write (the on_security_event trigger, or the
# simulated-attack burst) would otherwise discard those just-written events as
# "in the future" and lose their signal — the SIM_ATTACK marker included. Allow
# a small skew margin here; timestamps implausibly far ahead are still rejected.
_CLOCK_SKEW_TOLERANCE_S = 30.0


def record_event(db, uid: str, event_type: str, meta: dict | None = None) -> str:
    if event_type not in VALID_TYPES:
        raise ValueError(f"unknown security event type: {event_type!r}")
    return repo.add(
        db,
        "securityEvents",
        {"uid": uid, "type": event_type, "meta": dict(meta or {}), "ts": repo.SERVER_TIMESTAMP},
    )


def _to_epoch(ts) -> float | None:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.timestamp()
    # google.api_core DatetimeWithNanoseconds is a datetime subclass; guard anything else
    try:
        return ts.timestamp()  # type: ignore[attr-defined]
    except AttributeError:
        return None


def load_events_window(db, uid: str, now: float, window_seconds: float) -> list[SecurityEvent]:
    rows = repo.query_recent_events(db, uid, now - window_seconds)
    out: list[SecurityEvent] = []
    for r in rows:
        epoch = _to_epoch(r.get("ts"))
        if epoch is None or epoch > now + _CLOCK_SKEW_TOLERANCE_S:
            continue
        out.append(SecurityEvent(uid=r["uid"], type=r["type"], ts=epoch, meta=dict(r.get("meta") or {})))
    return out
