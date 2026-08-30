"""Cloud Functions entrypoint. Thin: auth-guard, delegate to fb/, map errors."""

from __future__ import annotations

import functools
import json
import urllib.request

from firebase_functions import firestore_fn, https_fn
from firebase_functions.params import SecretParam

from quantumsafe.fb import enforcement, identity, messaging, repo, scoring, sessions, simulation
from quantumsafe.fb import events as fb_events
from quantumsafe.fb.client import _ensure_app, get_db
from quantumsafe.fb.config import DATABASE, REGION
from quantumsafe.fb.errors import FORBIDDEN, REAUTH_REQUIRED, AppError, to_https_error
from quantumsafe.security.events import LOGIN_FAIL, RE_AUTH_FAIL, RE_AUTH_OK

# Single Firebase init path: `_ensure_app` prefers functions/serviceAccountKey.json
# locally and falls back to ADC in Cloud Functions. Initialising here directly
# would race with it depending on import order.
_ensure_app()

APP_SECRET = SecretParam("APP_SECRET")
WEB_API_KEY = "AIzaSyCKr9ISLAHwCKCMcmrgGhxpxBa7dSKqYYA"  # public by design

_CALL = {"region": REGION, "secrets": [APP_SECRET]}


def _require_auth(req: https_fn.CallableRequest) -> str:
    if req.auth is None or not req.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="sign-in required"
        )
    return req.auth.uid


def _secret() -> bytes:
    return APP_SECRET.value.encode("utf-8")


def _guard(fn):
    @functools.wraps(fn)
    def wrapper(req: https_fn.CallableRequest):
        try:
            return fn(req)
        except AppError as err:
            raise to_https_error(err) from err
        except (KeyError, ValueError) as err:
            # A missing `req.data` field or an invalid enum value (e.g.
            # set_status's status) is a client mistake, not a server fault.
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message=str(err)
            ) from err

    return wrapper


@https_fn.on_call(**_CALL)
@_guard
def register_keys(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    email = (req.auth.token or {}).get("email")
    created = identity.provision_user(
        get_db(), uid, _secret(), display_name=(req.data or {}).get("displayName"), email=email
    )
    return {"created": created}


@https_fn.on_call(**_CALL)
@_guard
def establish_session(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    peer = (req.data or {})["peerUid"]
    return {"sessionId": sessions.establish_session(get_db(), uid, peer, _secret())}


@https_fn.on_call(**_CALL)
@_guard
def send_message(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    data = req.data or {}
    mid = messaging.send_message(get_db(), data["sessionId"], uid, data["plaintext"], _secret())
    return {"messageId": mid}


@https_fn.on_call(**_CALL)
@_guard
def read_message(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    mid = (req.data or {})["messageId"]
    return {"plaintext": messaging.read_message(get_db(), mid, uid, _secret())}


def _verify_password(email: str, password: str) -> bool:
    body = json.dumps(
        {"email": email, "password": password, "returnSecureToken": True}
    ).encode("utf-8")
    url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + WEB_API_KEY
    )
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


@https_fn.on_call(**_CALL)
@_guard
def reauth(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    db = get_db()
    email = (req.auth.token or {}).get("email")
    ok = bool(email) and _verify_password(email, (req.data or {}).get("password", ""))
    if not ok:
        # Record BOTH: RE_AUTH_FAIL is the audit-accurate type, but
        # features.extract_features only counts LOGIN_FAIL for the
        # login_fail_count / login_fail_rate features and the +0.40 rule boost,
        # so without it a real brute force against reauth scores zero risk.
        fb_events.record_event(db, uid, RE_AUTH_FAIL)
        fb_events.record_event(db, uid, LOGIN_FAIL)
        raise AppError(REAUTH_REQUIRED, "re-authentication failed")

    repo.merge(db, "users", uid, {"reauthAt": repo.SERVER_TIMESTAMP})
    fb_events.record_event(db, uid, RE_AUTH_OK)
    assessment, previous = scoring.rescore_user(db, uid)
    enforcement.apply_policy(db, uid, assessment, previous)
    return {"ok": True}


@https_fn.on_call(**_CALL)
@_guard
def simulate_attack(req: https_fn.CallableRequest):
    uid = _require_auth(req)
    data = req.data or {}
    kind = data.get("kind", "brute_force")
    target = data.get("targetUid", uid)
    if target != uid and (req.auth.token or {}).get("role") != "admin":
        raise AppError(FORBIDDEN, "only an admin can target another user")

    return {"events": simulation.run_simulated_attack(get_db(), target, kind)}


@https_fn.on_call(**_CALL)
@_guard
def admin_set_status(req: https_fn.CallableRequest):
    _require_auth(req)
    if (req.auth.token or {}).get("role") != "admin":
        raise AppError(FORBIDDEN, "admins only")
    data = req.data or {}
    enforcement.set_status(get_db(), data["uid"], data["status"], actor="admin")
    return {"ok": True}


@firestore_fn.on_document_created(
    document="securityEvents/{eventId}",
    database=DATABASE,
    region=REGION,
    secrets=[APP_SECRET],
    # Serialise trigger invocations: a simulated-attack burst writes up to 40
    # events, and concurrent rescore/apply_policy runs against one riskScores
    # doc produce a non-deterministic end state.
    max_instances=1,
)
def on_security_event_created(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    snap = event.data
    if snap is None:
        return
    uid = None
    try:
        # `DocumentSnapshot.get` raises KeyError on a missing field, so the
        # malformed-event guard must live inside the try.
        uid = (snap.to_dict() or {}).get("uid")
        if not uid:
            return
        db = get_db()
        assessment, previous = scoring.rescore_user(db, uid)
        enforcement.apply_policy(db, uid, assessment, previous)
    except Exception as e:  # a single bad event must not leave the function erroring
        print(f"on_security_event_created failed for {uid}: {e!r}")
        return
