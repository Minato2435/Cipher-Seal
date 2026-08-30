"""Thin typed Firestore access helpers. All collection names go through config."""

from __future__ import annotations

from datetime import datetime, timezone

from google.api_core.exceptions import FailedPrecondition
from google.cloud.firestore import SERVER_TIMESTAMP  # noqa: F401  (re-export)
from google.cloud.firestore_v1.base_query import FieldFilter

from quantumsafe.fb.config import collection


def get(db, base: str, doc_id: str) -> dict | None:
    snap = db.collection(collection(base)).document(doc_id).get()
    return snap.to_dict() if snap.exists else None


def set(db, base: str, doc_id: str, data: dict) -> None:
    db.collection(collection(base)).document(doc_id).set(data)


def merge(db, base: str, doc_id: str, data: dict) -> None:
    db.collection(collection(base)).document(doc_id).set(data, merge=True)


def add(db, base: str, data: dict) -> str:
    _, ref = db.collection(collection(base)).add(data)
    return ref.id


def _ts_at_least(value, floor: datetime) -> bool:
    """True when a Firestore timestamp value is resolved and >= floor."""
    if value is None or not hasattr(value, "timestamp"):
        return False
    return value >= floor


def query_recent_events(db, uid: str, since_ts_epoch: float) -> list[dict]:
    since = datetime.fromtimestamp(since_ts_epoch, tz=timezone.utc)
    base = db.collection(collection("securityEvents")).where(
        filter=FieldFilter("uid", "==", uid)
    )
    try:
        q = base.where(filter=FieldFilter("ts", ">=", since)).order_by("ts")
        return [d.to_dict() for d in q.stream()]
    except FailedPrecondition:
        # Composite (uid, ts) index not present for this collection group
        # (e.g. the per-session test_<uuid>_ prefix). Filter/order client-side.
        rows = [d.to_dict() for d in base.stream()]
        rows = [r for r in rows if _ts_at_least(r.get("ts"), since)]
        rows.sort(key=lambda r: r["ts"])
        return rows


def query_active_sessions_for(db, uid: str) -> list[tuple[str, dict]]:
    base = db.collection(collection("sessions")).where(
        filter=FieldFilter("participants", "array_contains", uid)
    )
    try:
        q = base.where(filter=FieldFilter("state", "==", "active"))
        return [(d.id, d.to_dict()) for d in q.stream()]
    except FailedPrecondition:
        # Composite (participants, state) index not present for this collection
        # group (e.g. the per-session test_<uuid>_ prefix). Filter client-side.
        rows = [(d.id, d.to_dict()) for d in base.stream()]
        return [(i, r) for i, r in rows if r.get("state") == "active"]
