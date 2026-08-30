"""Cloud Functions entrypoint. Thin: auth-guard, delegate to fb/, map errors."""

from __future__ import annotations

import json
import time
import urllib.request

import firebase_admin
from firebase_functions import firestore_fn, https_fn
from firebase_functions.params import SecretParam

from quantumsafe.fb import enforcement, identity, messaging, repo, scoring, sessions
from quantumsafe.fb import events as fb_events
from quantumsafe.fb.client import get_db
from quantumsafe.fb.config import DATABASE, REGION
from quantumsafe.fb.errors import FORBIDDEN, REAUTH_REQUIRED, AppError, to_https_error
from quantumsafe.security.events import RE_AUTH_FAIL, RE_AUTH_OK, SIM_ATTACK
from quantumsafe.ai.synthetic import generate_attack_events

if not firebase_admin._apps:
    firebase_admin.initialize_app()

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
    def wrapper(req: https_fn.CallableRequest):
        try:
            return fn(req)
        except AppError as err:
            raise to_https_error(err) from err

    wrapper.__name__ = fn.__name__
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
        fb_events.record_event(db, uid, RE_AUTH_FAIL)
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

    import numpy as np

    db = get_db()
    now = time.time()
    synth = generate_attack_events(np.random.default_rng(), target, now, 300.0, kind=kind)
    count = 0
    for ev in synth:
        fb_events.record_event(db, target, ev.type, {**ev.meta, "simulated": True})
        count += 1
    fb_events.record_event(db, target, SIM_ATTACK, {"kind": kind})
    return {"events": count + 1}


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
    document="securityEvents/{eventId}", database=DATABASE, region=REGION, secrets=[APP_SECRET]
)
def on_security_event_created(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    snap = event.data
    if snap is None:
        return
    uid = snap.get("uid")
    if not uid:
        return
    db = get_db()
    assessment, previous = scoring.rescore_user(db, uid)
    enforcement.apply_policy(db, uid, assessment, previous)
