"""Apply an adaptive-security PolicyAction to Firestore + Firebase Auth."""

from __future__ import annotations

from quantumsafe.fb import repo
from quantumsafe.fb.client import get_auth
from quantumsafe.fb.config import collection
from quantumsafe.security.policy import STATUS_FOR, decide


def _sync_claim(uid: str, status: str) -> None:
    auth = get_auth()
    try:
        user = auth.get_user(uid)
    except auth.UserNotFoundError:
        # A security event can reference a uid with no Auth record (test/seed
        # data, deleted users); Firestore state is still updated by the caller.
        return
    existing = dict(user.custom_claims or {})
    if existing.get("status") != status:
        existing["status"] = status
        auth.set_custom_user_claims(uid, existing)


def _terminate_sessions(db, uid: str) -> None:
    for sid, _ in repo.query_active_sessions_for(db, uid):
        db.collection(collection("sessions")).document(sid).update({"state": "terminated"})
    auth = get_auth()
    try:
        auth.revoke_refresh_tokens(uid)
    except auth.UserNotFoundError:
        # uid with no Auth record (test/seed data); Firestore sessions are still
        # terminated above.
        return


def apply_policy(db, uid: str, assessment, previous_band: str):
    action = decide(previous_band, assessment.band)

    repo.merge(db, "users", uid, {"status": action.status})
    _sync_claim(uid, action.status)

    if action.action != "NONE":
        repo.add(
            db,
            "policyActions",
            {
                "uid": uid,
                "fromBand": action.from_band,
                "toBand": action.to_band,
                "action": action.action,
                "actor": "system",
                "ts": repo.SERVER_TIMESTAMP,
            },
        )

    if action.terminate_sessions:
        _terminate_sessions(db, uid)

    if action.raise_alert:
        repo.add(
            db,
            "alerts",
            {
                "uid": uid,
                "reason": f"risk {assessment.score:.2f} -> {assessment.band}",
                "ts": repo.SERVER_TIMESTAMP,
                "acknowledged": False,
            },
        )

    return action


def set_status(db, uid: str, status: str, *, actor: str) -> None:
    if status not in STATUS_FOR.values():
        raise ValueError(f"invalid status: {status!r}")
    repo.merge(db, "users", uid, {"status": status})
    _sync_claim(uid, status)
    repo.add(
        db,
        "policyActions",
        {
            "uid": uid,
            "fromBand": None,
            "toBand": None,
            "action": f"SET_STATUS:{status}",
            "actor": actor,
            "ts": repo.SERVER_TIMESTAMP,
        },
    )
