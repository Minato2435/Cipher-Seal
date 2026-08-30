# Firebase Backend (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Part 1 `quantumsafe` core to Cloud Firestore + Firebase Auth as a set of Cloud Functions (7 callables + 1 Firestore trigger), developed and tested against the real `default2` database, then deployed to `asia-south1`.

**Architecture:** `functions/main.py` is a thin entrypoint holding the `@https_fn.on_call` / `@firestore_fn.on_document_created` decorators. All real logic lives in testable `functions/quantumsafe/fb/*` modules that take a Firestore client (`db`) as a parameter and call the pure Part 1 package. Tests run locally against real `default2` under a per-run collection-name prefix (`QS_COLLECTION_PREFIX`) and clean up after themselves. The Firestore trigger is verified by a post-deploy live smoke test.

**Tech Stack:** Python 3.12, `firebase-functions==0.6.0`, `firebase-admin==7.5.0`, plus the Part 1 deps (`kyber-py`, `dilithium-py`, `cryptography`, `scikit-learn`, `numpy`, `joblib`). Firebase CLI 15.26.0.

**Spec:** `docs/superpowers/specs/2026-08-29-smart-quantum-safe-comm-design.md` (§3.1–3.5). This plan is spec phase 5 (Cloud Functions wiring); Firestore security rules (§3.7) are Part 3, the React app (§3.6) is Part 4, production deploy hardening is Part 5.

## Global Constraints

- **Project:** `legaldoc-14f4d`. **Firestore database:** `default2` (NOT `(default)`) — must be passed explicitly everywhere: `firestore.client(database_id="default2")`, `database="default2"` on the trigger, `"database": "default2"` in `firebase.json`. **Region:** `asia-south1` for all functions.
- **Credentials:** `functions/serviceAccountKey.json` exists and is git-ignored (service account `firebase-adminsdk-fbsvc@legaldoc-14f4d.iam.gserviceaccount.com`). Never commit it, never print its contents.
- **`APP_SECRET`** is the keystore KEK seed. Runtime: `firebase_functions.params.SecretParam("APP_SECRET")`. Local/tests: env var `APP_SECRET` (conftest sets a fixed test value if unset).
- **Collection namespacing:** every Firestore collection name goes through `fb.config.collection(base)`, which prepends `os.environ.get("QS_COLLECTION_PREFIX", "")`. Production leaves it unset; tests set `test_<uuid>_` and delete those collections in teardown. NEVER write to an unprefixed collection from a test.
- **No emulator.** Tests hit real `default2`. Keep test data tiny and always clean up.
- **Ciphertext only.** `messages` docs store `iv_b64` / `ct_b64` / `tag_b64` / `sig_b64` and metadata — never plaintext. `privateKeys` docs store only the wrapped-key dicts from Part 1's `keystore`.
- **Reuse Part 1 verbatim.** Import from `quantumsafe.crypto`, `quantumsafe.ai`, `quantumsafe.security` — do not reimplement crypto, feature extraction, scoring, or the policy machine.
- Event-type strings, `FEATURE_NAMES`, `Thresholds`, `decide()` semantics are fixed by Part 1.
- Python invoked as `python`; pytest as `python -m pytest`. Line-ending warnings from git are harmless.
- Commit after every task with the message in its final step.

## Interfaces available from Part 1 (`functions/quantumsafe/`, already on `master`)

- `crypto.kdf.hkdf_sha256(ikm, *, salt=b"", info=b"", length=32) -> bytes`
- `crypto.aead`: `aes256gcm_encrypt(key, plaintext, aad=b"") -> AeadResult(iv, ciphertext, tag)`; `aes256gcm_decrypt(key, iv, ciphertext, tag, aad=b"") -> bytes`
- `crypto.kem`: `kem_encapsulate(ek) -> (shared, kem_ct)`; `kem_decapsulate(dk, kem_ct) -> shared`; `ALG`
- `crypto.sign`: `sign(sk, message, context=b"") -> bytes`; `verify(pk, message, signature, context=b"") -> bool`; `ALG`
- `crypto.keystore`: `generate_user_keys(app_secret: bytes, uid: str) -> {"public": {...}, "private": {...}}`; `wrap_private_key(app_secret, private_key, alg, uid) -> dict`; `unwrap_private_key(app_secret, wrapped, uid) -> bytes`
- `security.events`: `SecurityEvent(uid, type, ts, meta)`; constants `LOGIN_OK LOGIN_FAIL MSG_SENT MSG_RECV TAMPER SESSION_ESTABLISH RE_AUTH_OK RE_AUTH_FAIL SIM_ATTACK`; `VALID_TYPES`
- `ai.features`: `FEATURE_NAMES`, `DEFAULT_WINDOW_SECONDS = 300.0`, `extract_features(events, *, now, window_seconds=...) -> dict`, `features_to_vector(feats) -> list[float]`
- `ai.model`: `RiskModel.load(path) -> RiskModel`; `.raw_score(vector) -> float`
- `ai.risk`: `Thresholds(elevated, high, critical)` with `.from_dict`/`.to_dict`; `assess(feats, model_score, thresholds) -> RiskAssessment(score, band, model_score, rule_boost, components)`
- `ai.synthetic`: `generate_normal_events`, `generate_attack_events`, `build_training_matrix`
- `security.policy`: `decide(previous_band, new_band) -> PolicyAction(from_band, to_band, action, status, terminate_sessions, raise_alert, require_reauth)`; `STATUS_FOR`

## firebase-functions 0.6.0 API (verified against the installed package)

- `@https_fn.on_call(region="asia-south1", secrets=[APP_SECRET])` decorates `def fn(req: https_fn.CallableRequest) -> Any`. `req.data` is a dict; `req.auth` is `AuthData(uid: str|None, token: dict)` or `None`.
- Raise `https_fn.HttpsError(code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION, message="...")`. Codes include `UNAUTHENTICATED PERMISSION_DENIED FAILED_PRECONDITION NOT_FOUND INVALID_ARGUMENT INTERNAL`.
- `@firestore_fn.on_document_created(document="col/{id}", database="default2", region="asia-south1")` decorates `def fn(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None`. `event.data` is the created `DocumentSnapshot`; `event.params["id"]` holds the wildcard.
- `from firebase_functions.params import SecretParam` → `APP_SECRET = SecretParam("APP_SECRET")` → `APP_SECRET.value` at runtime (a str).
- `firebase_admin.initialize_app()` once at module import.

---

### Task 1: Firebase project scaffold

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Modify: `functions/requirements.txt` (append two lines)
- Modify: `.gitignore` (append)
- Create: `functions/tests/test_fb_scaffold.py`

**Interfaces:**
- Consumes: nothing.
- Produces: the deploy configuration every later task and the deploy step depend on.

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_scaffold.py`:

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def test_firebaserc_targets_the_project():
    assert _load(".firebaserc")["projects"]["default"] == "legaldoc-14f4d"


def test_firebase_json_binds_the_named_database_and_region():
    cfg = _load("firebase.json")
    assert cfg["firestore"]["database"] == "default2"
    assert cfg["firestore"]["rules"] == "firestore.rules"
    assert cfg["firestore"]["indexes"] == "firestore.indexes.json"
    fns = cfg["functions"]
    fn = fns[0] if isinstance(fns, list) else fns
    assert fn["source"] == "functions"
    assert fn["runtime"] == "python312"


def test_indexes_cover_the_two_hot_queries():
    idx = _load("firestore.indexes.json")["indexes"]
    fields = {tuple(f["fieldPath"] for f in i["fields"]): i["collectionGroup"] for i in idx}
    assert ("uid", "ts") in fields and fields[("uid", "ts")] == "securityEvents"
    assert ("sessionId", "createdAt") in fields and fields[("sessionId", "createdAt")] == "messages"


def test_requirements_has_firebase_packages():
    req = (ROOT / "functions/requirements.txt").read_text(encoding="utf-8")
    assert "firebase-functions==0.6.0" in req
    assert "firebase-admin==7.5.0" in req
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_scaffold.py -v`
Expected: FAIL — `FileNotFoundError: .firebaserc` (or KeyError).

- [ ] **Step 3: Create the scaffold**

`.firebaserc`:

```json
{
  "projects": {
    "default": "legaldoc-14f4d"
  }
}
```

`firebase.json`:

```json
{
  "firestore": {
    "database": "default2",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "python312",
      "ignore": [
        "venv",
        ".venv",
        "serviceAccountKey.json",
        ".secret.local",
        "tests",
        "__pycache__",
        "*.local"
      ]
    }
  ]
}
```

`firestore.rules` (placeholder — Part 3 replaces this with participant-scoped rules):

```
rules_version = '2';
// PLACEHOLDER RULES — replaced in Part 3 with participant-scoped access.
// All privileged writes go through Cloud Functions (Admin SDK bypasses rules).
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "securityEvents",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Append to `functions/requirements.txt`:

```
firebase-functions==0.6.0
firebase-admin==7.5.0
```

Append to `.gitignore`:

```
# Firebase build/deploy artifacts
.firebase/
firebase-debug.log
functions/venv/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_scaffold.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add .firebaserc firebase.json firestore.rules firestore.indexes.json functions/requirements.txt .gitignore functions/tests/test_fb_scaffold.py
git commit -m "chore: scaffold Firebase project config for default2 / asia-south1"
```

---

### Task 2: `fb.config` + `fb.client`

**Files:**
- Create: `functions/quantumsafe/fb/__init__.py` (empty)
- Create: `functions/quantumsafe/fb/config.py`
- Create: `functions/quantumsafe/fb/client.py`
- Create: `functions/tests/conftest.py`
- Create: `functions/tests/test_fb_client.py`

**Interfaces:**
- Consumes: `functions/serviceAccountKey.json`.
- Produces:
  - `config.REGION = "asia-south1"`, `config.DATABASE = "default2"`, `config.DEFAULT_WINDOW_SECONDS` (re-export of Part 1's)
  - `config.app_secret() -> bytes` — from env `APP_SECRET` (UTF-8 encoded); raises `RuntimeError` if unset/empty
  - `config.collection(base: str) -> str` — `os.environ.get("QS_COLLECTION_PREFIX", "") + base`
  - `config.model_path() -> str`, `config.thresholds_path() -> str` — absolute paths to the bundled `functions/model.joblib` / `functions/thresholds.json`
  - `client.get_db()` — memoised `google.cloud.firestore.Client` for database `default2`; initialises the `firebase_admin` app once (service-account file if present next to `functions/`, else ADC)
  - `client.get_auth()` — the `firebase_admin.auth` module (after app init)
  - `conftest.py` fixtures: `db` (session), autouse `_prefixed_collections` (function) that guarantees `QS_COLLECTION_PREFIX` is set and deletes every prefixed collection used, after each test

- [ ] **Step 1: Write the failing test**

`functions/tests/conftest.py`:

```python
import os
import uuid

import pytest

os.environ.setdefault("APP_SECRET", "test-app-secret-do-not-use-in-prod-000")
os.environ["QS_COLLECTION_PREFIX"] = f"test_{uuid.uuid4().hex[:10]}_"

_APP_COLLECTIONS = [
    "users", "publicKeys", "privateKeys", "sessions", "messages",
    "securityEvents", "riskScores", "policyActions", "alerts",
]


@pytest.fixture(scope="session")
def db():
    from quantumsafe.fb.client import get_db
    return get_db()


def _wipe(db):
    from quantumsafe.fb.config import collection
    for base in _APP_COLLECTIONS:
        col = db.collection(collection(base))
        for doc in col.limit(500).stream():
            doc.reference.delete()


@pytest.fixture(autouse=True)
def _prefixed_collections(db):
    _wipe(db)
    yield
    _wipe(db)
```

`functions/tests/test_fb_client.py`:

```python
import pytest

from quantumsafe.fb import config
from quantumsafe.fb.client import get_db


def test_collection_prefixing_is_active_in_tests():
    name = config.collection("users")
    assert name.startswith("test_") and name.endswith("_users")


def test_app_secret_returns_bytes():
    assert isinstance(config.app_secret(), bytes)
    assert len(config.app_secret()) > 0


def test_region_and_database_constants():
    assert config.REGION == "asia-south1"
    assert config.DATABASE == "default2"


def test_get_db_round_trips_a_document_on_default2(db):
    ref = db.collection(config.collection("users")).document("probe")
    ref.set({"hello": "default2"})
    got = ref.get()
    assert got.exists and got.to_dict()["hello"] == "default2"
    ref.delete()


def test_bundled_model_artifacts_exist():
    import os
    assert os.path.isfile(config.model_path())
    assert os.path.isfile(config.thresholds_path())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/config.py`:

```python
"""Runtime configuration for the Firebase adapter layer."""

from __future__ import annotations

import os
from pathlib import Path

from quantumsafe.ai.features import DEFAULT_WINDOW_SECONDS  # re-export

REGION = "asia-south1"
DATABASE = "default2"

_FUNCTIONS_DIR = Path(__file__).resolve().parents[2]  # .../functions


def app_secret() -> bytes:
    raw = os.environ.get("APP_SECRET", "")
    if not raw:
        raise RuntimeError("APP_SECRET is not set")
    return raw.encode("utf-8")


def collection(base: str) -> str:
    return os.environ.get("QS_COLLECTION_PREFIX", "") + base


def model_path() -> str:
    return str(_FUNCTIONS_DIR / "model.joblib")


def thresholds_path() -> str:
    return str(_FUNCTIONS_DIR / "thresholds.json")


__all__ = [
    "REGION", "DATABASE", "DEFAULT_WINDOW_SECONDS",
    "app_secret", "collection", "model_path", "thresholds_path",
]
```

`functions/quantumsafe/fb/client.py`:

```python
"""Firestore + Auth clients bound to the non-default `default2` database."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import firebase_admin
from firebase_admin import auth as _auth
from firebase_admin import credentials, firestore

from quantumsafe.fb.config import DATABASE

_KEY_FILE = Path(__file__).resolve().parents[2] / "serviceAccountKey.json"


def _ensure_app() -> None:
    if firebase_admin._apps:  # already initialised
        return
    if _KEY_FILE.is_file() and "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ:
        firebase_admin.initialize_app(credentials.Certificate(str(_KEY_FILE)))
    else:
        firebase_admin.initialize_app()


@lru_cache(maxsize=1)
def get_db():
    _ensure_app()
    return firestore.client(database_id=DATABASE)


def get_auth():
    _ensure_app()
    return _auth
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_client.py -v`
Expected: PASS (5 tests). Real writes land in `default2` under a `test_…_` prefix and are cleaned up.

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/__init__.py functions/quantumsafe/fb/config.py functions/quantumsafe/fb/client.py functions/tests/conftest.py functions/tests/test_fb_client.py
git commit -m "feat(fb): config + Firestore/Auth clients bound to default2"
```

---

### Task 3: `fb.errors`

**Files:**
- Create: `functions/quantumsafe/fb/errors.py`
- Create: `functions/tests/test_fb_errors.py`

**Interfaces:**
- Consumes: `firebase_functions.https_fn`.
- Produces:
  - `class AppError(Exception)` — `AppError(code: str, message: str)`, attrs `.code`, `.message`
  - Module constants: `REAUTH_REQUIRED`, `ACCOUNT_BLOCKED`, `SIGNATURE_INVALID`, `DECRYPT_FAILED`, `PEER_NOT_READY`, `NOT_PARTICIPANT`, `FORBIDDEN`, `NOT_FOUND` (each a `str` equal to its own name)
  - `to_https_error(err: AppError) -> https_fn.HttpsError`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_errors.py`:

```python
from firebase_functions import https_fn

from quantumsafe.fb import errors
from quantumsafe.fb.errors import AppError, to_https_error


def test_codes_are_self_named():
    assert errors.REAUTH_REQUIRED == "REAUTH_REQUIRED"
    assert errors.ACCOUNT_BLOCKED == "ACCOUNT_BLOCKED"
    assert errors.NOT_PARTICIPANT == "NOT_PARTICIPANT"


def test_app_error_carries_code_and_message():
    e = AppError(errors.PEER_NOT_READY, "peer has no keys")
    assert e.code == "PEER_NOT_READY"
    assert e.message == "peer has no keys"
    assert "peer has no keys" in str(e)


def test_mapping_to_https_error():
    blocked = to_https_error(AppError(errors.ACCOUNT_BLOCKED, "blocked"))
    assert isinstance(blocked, https_fn.HttpsError)
    assert blocked.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    reauth = to_https_error(AppError(errors.REAUTH_REQUIRED, "reauth"))
    assert reauth.code == https_fn.FunctionsErrorCode.FAILED_PRECONDITION

    forbidden = to_https_error(AppError(errors.FORBIDDEN, "admins only"))
    assert forbidden.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    unknown = to_https_error(AppError("SOMETHING_ELSE", "x"))
    assert unknown.code == https_fn.FunctionsErrorCode.INTERNAL
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_errors.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.errors'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/errors.py`:

```python
"""Domain errors and their mapping to callable-function error codes."""

from __future__ import annotations

from firebase_functions import https_fn

REAUTH_REQUIRED = "REAUTH_REQUIRED"
ACCOUNT_BLOCKED = "ACCOUNT_BLOCKED"
SIGNATURE_INVALID = "SIGNATURE_INVALID"
DECRYPT_FAILED = "DECRYPT_FAILED"
PEER_NOT_READY = "PEER_NOT_READY"
NOT_PARTICIPANT = "NOT_PARTICIPANT"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"


class AppError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


_FEC = https_fn.FunctionsErrorCode
_MAP = {
    REAUTH_REQUIRED: _FEC.FAILED_PRECONDITION,
    ACCOUNT_BLOCKED: _FEC.PERMISSION_DENIED,
    SIGNATURE_INVALID: _FEC.FAILED_PRECONDITION,
    DECRYPT_FAILED: _FEC.INTERNAL,
    PEER_NOT_READY: _FEC.FAILED_PRECONDITION,
    NOT_PARTICIPANT: _FEC.PERMISSION_DENIED,
    FORBIDDEN: _FEC.PERMISSION_DENIED,
    NOT_FOUND: _FEC.NOT_FOUND,
}


def to_https_error(err: AppError) -> https_fn.HttpsError:
    code = _MAP.get(err.code, _FEC.INTERNAL)
    return https_fn.HttpsError(code=code, message=f"{err.code}: {err.message}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_errors.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/errors.py functions/tests/test_fb_errors.py
git commit -m "feat(fb): domain errors and HttpsError mapping"
```

---

### Task 4: `fb.repo`

**Files:**
- Create: `functions/quantumsafe/fb/repo.py`
- Create: `functions/tests/test_fb_repo.py`

**Interfaces:**
- Consumes: `fb.config.collection`, a Firestore `db`.
- Produces (all take `db` first):
  - `get(db, base, doc_id) -> dict | None`
  - `set(db, base, doc_id, data: dict) -> None` (overwrite)
  - `merge(db, base, doc_id, data: dict) -> None` (`set(..., merge=True)`)
  - `add(db, base, data: dict) -> str` (auto-id, returns id)
  - `query_recent_events(db, uid, since_ts_epoch: float) -> list[dict]` — `securityEvents` where `uid == uid` and `ts >= <Timestamp(since)>`, ordered by `ts`
  - `query_active_sessions_for(db, uid) -> list[tuple[str, dict]]` — `sessions` where `participants array_contains uid` and `state == "active"`
  - `SERVER_TIMESTAMP` — re-export of `firestore.SERVER_TIMESTAMP`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_repo.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_repo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.repo'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/repo.py`:

```python
"""Thin typed Firestore access helpers. All collection names go through config."""

from __future__ import annotations

from datetime import datetime, timezone

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


def query_recent_events(db, uid: str, since_ts_epoch: float) -> list[dict]:
    since = datetime.fromtimestamp(since_ts_epoch, tz=timezone.utc)
    q = (
        db.collection(collection("securityEvents"))
        .where(filter=FieldFilter("uid", "==", uid))
        .where(filter=FieldFilter("ts", ">=", since))
        .order_by("ts")
    )
    return [d.to_dict() for d in q.stream()]


def query_active_sessions_for(db, uid: str) -> list[tuple[str, dict]]:
    q = (
        db.collection(collection("sessions"))
        .where(filter=FieldFilter("participants", "array_contains", uid))
        .where(filter=FieldFilter("state", "==", "active"))
    )
    return [(d.id, d.to_dict()) for d in q.stream()]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_repo.py -v`
Expected: PASS (3 tests). Firestore may log a one-time "index building" message for the `securityEvents` composite query — if the query raises `FailedPrecondition` asking for an index, create it via the URL in the error or `firebase deploy --only firestore:indexes`, then re-run. The `firestore.indexes.json` from Task 1 already declares it.

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/repo.py functions/tests/test_fb_repo.py
git commit -m "feat(fb): typed Firestore access helpers"
```

---

### Task 5: `fb.events`

**Files:**
- Create: `functions/quantumsafe/fb/events.py`
- Create: `functions/tests/test_fb_events.py`

**Interfaces:**
- Consumes: `fb.repo`, `quantumsafe.security.events` (`VALID_TYPES`, `SecurityEvent`).
- Produces:
  - `record_event(db, uid: str, event_type: str, meta: dict | None = None) -> str` — validates `event_type in VALID_TYPES` (else `ValueError`), writes `securityEvents/{auto}` `{uid, type, meta, ts: SERVER_TIMESTAMP}`, returns id
  - `load_events_window(db, uid: str, now: float, window_seconds: float) -> list[SecurityEvent]` — reads via `repo.query_recent_events(db, uid, now - window_seconds)`, converts each doc's Firestore `ts` to an epoch float, returns Part 1 `SecurityEvent` objects (skipping rows whose `ts` is still an unresolved server sentinel / `None`)

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_events.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_events.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.events'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/events.py`:

```python
"""Security-event persistence: write to Firestore, read back as Part 1 objects."""

from __future__ import annotations

from datetime import datetime, timezone

from quantumsafe.fb import repo
from quantumsafe.security.events import VALID_TYPES, SecurityEvent


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
        if epoch is None or epoch > now:
            continue
        out.append(SecurityEvent(uid=r["uid"], type=r["type"], ts=epoch, meta=dict(r.get("meta") or {})))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_events.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/events.py functions/tests/test_fb_events.py
git commit -m "feat(fb): security-event persistence and window loading"
```

---

### Task 6: `fb.identity`

**Files:**
- Create: `functions/quantumsafe/fb/identity.py`
- Create: `functions/tests/test_fb_identity.py`

**Interfaces:**
- Consumes: `fb.repo`, `quantumsafe.crypto.keystore` (`generate_user_keys`, `unwrap_private_key`), base64.
- Produces:
  - `provision_user(db, uid: str, app_secret: bytes, *, display_name: str | None = None, email: str | None = None) -> bool` — idempotent; returns `True` if it created keys, `False` if `publicKeys/{uid}` already existed. On create: writes `publicKeys/{uid}` (the `public` sub-dict), `privateKeys/{uid}` (the `private` sub-dict), and merges `users/{uid}` `{displayName, email, role:"user", status:"normal", createdAt: SERVER_TIMESTAMP}` (never downgrades an existing `role`/`status`).
  - `load_kem_public(db, uid) -> bytes` — b64-decodes `publicKeys/{uid}.mlkemPub_b64`; raises `AppError(PEER_NOT_READY, ...)` if missing
  - `load_sign_public(db, uid) -> bytes` — from `mldsaPub_b64`; same missing behaviour
  - `load_sign_secret(db, uid, app_secret) -> bytes` — `unwrap_private_key(app_secret, privateKeys/{uid}.mldsaPriv_enc, uid)`
  - `load_kem_secret(db, uid, app_secret) -> bytes` — `unwrap_private_key(app_secret, privateKeys/{uid}.mlkemPriv_enc, uid)`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_identity.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_identity.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.identity'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/identity.py`:

```python
"""Per-user PQC key provisioning and loading, backed by Firestore."""

from __future__ import annotations

import base64

from quantumsafe.crypto.keystore import generate_user_keys, unwrap_private_key
from quantumsafe.fb import repo
from quantumsafe.fb.errors import PEER_NOT_READY, AppError


def provision_user(
    db,
    uid: str,
    app_secret: bytes,
    *,
    display_name: str | None = None,
    email: str | None = None,
) -> bool:
    if repo.get(db, "publicKeys", uid) is not None:
        return False

    material = generate_user_keys(app_secret, uid)
    repo.set(db, "publicKeys", uid, material["public"])
    repo.set(db, "privateKeys", uid, material["private"])
    repo.merge(
        db,
        "users",
        uid,
        {
            "displayName": display_name or uid,
            "email": email,
            "role": "user",
            "status": "normal",
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    return True


def _pub(db, uid: str) -> dict:
    doc = repo.get(db, "publicKeys", uid)
    if doc is None:
        raise AppError(PEER_NOT_READY, f"user {uid} has no published keys")
    return doc


def load_kem_public(db, uid: str) -> bytes:
    return base64.b64decode(_pub(db, uid)["mlkemPub_b64"])


def load_sign_public(db, uid: str) -> bytes:
    return base64.b64decode(_pub(db, uid)["mldsaPub_b64"])


def _priv(db, uid: str) -> dict:
    doc = repo.get(db, "privateKeys", uid)
    if doc is None:
        raise AppError(PEER_NOT_READY, f"user {uid} has no private keys")
    return doc


def load_sign_secret(db, uid: str, app_secret: bytes) -> bytes:
    return unwrap_private_key(app_secret, _priv(db, uid)["mldsaPriv_enc"], uid)


def load_kem_secret(db, uid: str, app_secret: bytes) -> bytes:
    return unwrap_private_key(app_secret, _priv(db, uid)["mlkemPriv_enc"], uid)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_identity.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/identity.py functions/tests/test_fb_identity.py
git commit -m "feat(fb): per-user PQC key provisioning and loading"
```

---

### Task 7: `fb.sessions`

**Files:**
- Create: `functions/quantumsafe/fb/sessions.py`
- Create: `functions/tests/test_fb_sessions.py`

**Interfaces:**
- Consumes: `fb.identity`, `fb.events`, `fb.repo`, `quantumsafe.crypto` (`kem`, `kdf`, `keystore`), `quantumsafe.security.events.SESSION_ESTABLISH`.
- Produces:
  - `SESSION_INFO = b"quantumsafe-session-v1"`
  - `establish_session(db, caller_uid: str, peer_uid: str, app_secret: bytes) -> str` — both users must be provisioned (else `AppError PEER_NOT_READY`); `kem_encapsulate(peer_kem_pub)`; `session_key = hkdf_sha256(shared, salt=kem_ct[:16], info=SESSION_INFO)`; store `sessions/{auto}` `{participants:[caller,peer], sessionKey_enc: wrap_private_key(app_secret, session_key, "AES-256-GCM", <session_id_placeholder>), kemCtB64, state:"active", createdAt}`. Because the wrap needs the session id and the id is auto-generated, create the doc first with a placeholder, then update `sessionKey_enc` using the real id as the keystore `uid`. Record `SESSION_ESTABLISH` for `caller_uid` with `meta={"peer": peer_uid, "sessionId": id}`. Return id.
  - `load_session_key(db, session_id: str, requester_uid: str, app_secret: bytes) -> bytes` — `AppError NOT_FOUND` if missing; `AppError NOT_PARTICIPANT` if `requester_uid not in participants`; `AppError FAILED`-style if `state != "active"` → use `AppError(NOT_PARTICIPANT, "session not active")` is wrong; add code `SESSION_INACTIVE`. (Add `SESSION_INACTIVE = "SESSION_INACTIVE"` to `errors.py` and map it to `FAILED_PRECONDITION` — do this as part of this task.)

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_sessions.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_sessions.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.sessions'`.

- [ ] **Step 3: Write minimal implementation**

First append to `functions/quantumsafe/fb/errors.py`:

```python
SESSION_INACTIVE = "SESSION_INACTIVE"
```

and add to the `_MAP` dict: `SESSION_INACTIVE: _FEC.FAILED_PRECONDITION,`.

`functions/quantumsafe/fb/sessions.py`:

```python
"""Per-conversation ML-KEM session establishment and key retrieval."""

from __future__ import annotations

import base64

from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import kem_encapsulate
from quantumsafe.crypto.keystore import unwrap_private_key, wrap_private_key
from quantumsafe.fb import events, identity, repo
from quantumsafe.fb.config import collection
from quantumsafe.fb.errors import NOT_FOUND, NOT_PARTICIPANT, SESSION_INACTIVE, AppError
from quantumsafe.security.events import SESSION_ESTABLISH

SESSION_INFO = b"quantumsafe-session-v1"
_SESSION_KEY_ALG = "AES-256-GCM"


def establish_session(db, caller_uid: str, peer_uid: str, app_secret: bytes) -> str:
    peer_ek = identity.load_kem_public(db, peer_uid)          # raises PEER_NOT_READY
    identity.load_kem_public(db, caller_uid)                  # caller must be provisioned too

    shared, kem_ct = kem_encapsulate(peer_ek)
    session_key = hkdf_sha256(shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)

    sid = repo.add(
        db,
        "sessions",
        {
            "participants": [caller_uid, peer_uid],
            "kemCtB64": base64.b64encode(kem_ct).decode("ascii"),
            "state": "active",
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    wrapped = wrap_private_key(app_secret, session_key, _SESSION_KEY_ALG, sid)
    db.collection(collection("sessions")).document(sid).update({"sessionKey_enc": wrapped})

    events.record_event(db, caller_uid, SESSION_ESTABLISH, {"peer": peer_uid, "sessionId": sid})
    return sid


def load_session_key(db, session_id: str, requester_uid: str, app_secret: bytes) -> bytes:
    doc = repo.get(db, "sessions", session_id)
    if doc is None:
        raise AppError(NOT_FOUND, f"session {session_id} not found")
    if requester_uid not in doc["participants"]:
        raise AppError(NOT_PARTICIPANT, "not a participant of this session")
    if doc.get("state") != "active":
        raise AppError(SESSION_INACTIVE, "session is not active")
    return unwrap_private_key(app_secret, doc["sessionKey_enc"], session_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_sessions.py functions/tests/test_fb_errors.py -v`
Expected: PASS (session tests + the unchanged error tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/sessions.py functions/quantumsafe/fb/errors.py functions/tests/test_fb_sessions.py
git commit -m "feat(fb): ML-KEM session establishment and key retrieval"
```

---

### Task 8: `fb.messaging`

**Files:**
- Create: `functions/quantumsafe/fb/messaging.py`
- Create: `functions/tests/test_fb_messaging.py`

**Interfaces:**
- Consumes: `fb.sessions`, `fb.identity`, `fb.events`, `fb.repo`, `quantumsafe.crypto` (`aead`, `sign`), `quantumsafe.security.events` (`MSG_SENT`, `MSG_RECV`, `TAMPER`).
- Produces:
  - `_binding_context(session_id, sender_uid, recipient_uid) -> bytes` = `f"{session_id}|{sender_uid}|{recipient_uid}".encode("ascii")`
  - `send_message(db, session_id, sender_uid, plaintext: str, app_secret) -> str` — resolves recipient from session participants; gate on `users/{sender}.status` (`"blocked"` → `AppError ACCOUNT_BLOCKED`; `"elevated"` and no `reauthAt` within 600 s → `AppError REAUTH_REQUIRED`); `key = load_session_key(...)`; `enc = aes256gcm_encrypt(key, plaintext.encode(), aad=ctx)`; `sig = sign(sender_sk, ctx + enc.iv + enc.ciphertext + enc.tag, context=ctx)`; write `messages/{auto}` with b64 fields + `sigAlg`, `verified=None`, `createdAt`; `record_event(MSG_SENT, {"size": len(plaintext), "recipient": recipient_uid})`. Return message id.
  - `read_message(db, message_id, reader_uid, app_secret) -> str` — `AppError NOT_FOUND` if missing; `AppError NOT_PARTICIPANT` if `reader_uid not in {senderUid, recipientUid}`; verify signature → on failure `repo.merge(messages, id, {"verified": False})`, `record_event(TAMPER, {"messageId": id})`, raise `AppError SIGNATURE_INVALID`; on success `repo.merge(messages, id, {"verified": True})`, decrypt (`AppError DECRYPT_FAILED` on `InvalidTag`), `record_event(MSG_RECV, {"messageId": id})`, return plaintext string.

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_messaging.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_messaging.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.messaging'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/messaging.py`:

```python
"""Send/receive: AES-256-GCM + ML-DSA over a session, ciphertext-only at rest."""

from __future__ import annotations

import base64
import time
from datetime import datetime, timezone

from cryptography.exceptions import InvalidTag

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.sign import ALG as SIGN_ALG
from quantumsafe.crypto.sign import sign, verify
from quantumsafe.fb import events, identity, repo, sessions
from quantumsafe.fb.errors import (
    ACCOUNT_BLOCKED,
    DECRYPT_FAILED,
    NOT_FOUND,
    NOT_PARTICIPANT,
    REAUTH_REQUIRED,
    SIGNATURE_INVALID,
    AppError,
)
from quantumsafe.security.events import MSG_RECV, MSG_SENT, TAMPER

_REAUTH_WINDOW_S = 600.0


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text)


def _binding_context(session_id: str, sender_uid: str, recipient_uid: str) -> bytes:
    return f"{session_id}|{sender_uid}|{recipient_uid}".encode("ascii")


def _gate_sender(db, sender_uid: str) -> None:
    user = repo.get(db, "users", sender_uid) or {}
    status = user.get("status", "normal")
    if status == "blocked":
        raise AppError(ACCOUNT_BLOCKED, "account is blocked")
    if status == "elevated":
        ts = user.get("reauthAt")
        epoch = ts.timestamp() if isinstance(ts, datetime) else None
        if epoch is None or (time.time() - epoch) > _REAUTH_WINDOW_S:
            raise AppError(REAUTH_REQUIRED, "re-authentication required before sending")


def send_message(db, session_id: str, sender_uid: str, plaintext: str, app_secret: bytes) -> str:
    session = repo.get(db, "sessions", session_id)
    if session is None:
        raise AppError(NOT_FOUND, f"session {session_id} not found")
    if sender_uid not in session["participants"]:
        raise AppError(NOT_PARTICIPANT, "not a participant of this session")
    recipient_uid = next(p for p in session["participants"] if p != sender_uid)

    _gate_sender(db, sender_uid)

    key = sessions.load_session_key(db, session_id, sender_uid, app_secret)
    ctx = _binding_context(session_id, sender_uid, recipient_uid)
    enc = aes256gcm_encrypt(key, plaintext.encode("utf-8"), aad=ctx)
    sk = identity.load_sign_secret(db, sender_uid, app_secret)
    signature = sign(sk, ctx + enc.iv + enc.ciphertext + enc.tag, context=ctx)

    mid = repo.add(
        db,
        "messages",
        {
            "sessionId": session_id,
            "senderUid": sender_uid,
            "recipientUid": recipient_uid,
            "iv_b64": _b64(enc.iv),
            "ct_b64": _b64(enc.ciphertext),
            "tag_b64": _b64(enc.tag),
            "sig_b64": _b64(signature),
            "sigAlg": SIGN_ALG,
            "verified": None,
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    events.record_event(db, sender_uid, MSG_SENT, {"size": len(plaintext), "recipient": recipient_uid})
    return mid


def read_message(db, message_id: str, reader_uid: str, app_secret: bytes) -> str:
    msg = repo.get(db, "messages", message_id)
    if msg is None:
        raise AppError(NOT_FOUND, f"message {message_id} not found")
    if reader_uid not in (msg["senderUid"], msg["recipientUid"]):
        raise AppError(NOT_PARTICIPANT, "not a participant of this message")

    ctx = _binding_context(msg["sessionId"], msg["senderUid"], msg["recipientUid"])
    iv, ct, tag = _unb64(msg["iv_b64"]), _unb64(msg["ct_b64"]), _unb64(msg["tag_b64"])
    sig = _unb64(msg["sig_b64"])
    sender_pk = identity.load_sign_public(db, msg["senderUid"])

    if not verify(sender_pk, ctx + iv + ct + tag, sig, context=ctx):
        repo.merge(db, "messages", message_id, {"verified": False})
        events.record_event(db, reader_uid, TAMPER, {"messageId": message_id})
        raise AppError(SIGNATURE_INVALID, "message signature failed verification")

    repo.merge(db, "messages", message_id, {"verified": True})
    key = sessions.load_session_key(db, msg["sessionId"], reader_uid, app_secret)
    try:
        plaintext = aes256gcm_decrypt(key, iv, ct, tag, aad=ctx)
    except InvalidTag as exc:
        raise AppError(DECRYPT_FAILED, "message could not be decrypted") from exc
    events.record_event(db, reader_uid, MSG_RECV, {"messageId": message_id})
    return plaintext.decode("utf-8")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_messaging.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/messaging.py functions/tests/test_fb_messaging.py
git commit -m "feat(fb): send/read message pipeline with tamper handling"
```

---

### Task 9: `fb.scoring` + threshold guard + conservative CRITICAL re-tune

**Files:**
- Modify: `scripts/seed_baseline.py` (floor `critical`, regenerate artefacts)
- Modify: `functions/model.joblib`, `functions/thresholds.json` (regenerated)
- Create: `functions/quantumsafe/fb/scoring.py`
- Create: `functions/tests/test_fb_scoring.py`
- Create: `functions/tests/test_fb_thresholds_guard.py`

**Interfaces:**
- Consumes: `fb.events`, `fb.repo`, `fb.config`, `quantumsafe.ai` (`features`, `model`, `risk`).
- Produces:
  - `load_thresholds() -> Thresholds` (from `config.thresholds_path()`)
  - `load_model() -> RiskModel` — module-level cached
  - `rescore_user(db, uid: str, now: float | None = None) -> tuple[RiskAssessment, str]` — returns `(assessment, previous_band)`; writes `riskScores/{uid}` `{score, band, modelScore, ruleBoost, components, updatedAt}`. `previous_band` is the pre-existing `riskScores/{uid}.band` or `"NORMAL"`.

**Re-tune requirement:** in `scripts/seed_baseline.py`'s threshold tuner, change the `critical` selection to `critical = max(0.78, _budget_bound(...), <p99.9 normal> + 0.01)` so account-blocking stays conservative. Regenerate with `python scripts/seed_baseline.py --out functions --users 500 --seed 42 --now 1735689600` and commit the new `model.joblib` + `thresholds.json`. Part 1's `test_synthetic.py` / `test_risk.py` assert against `Thresholds()` defaults and small vectors and must still pass unchanged; if `test_synthetic.py::test_training_matrix_shape_and_model_separates_attacks` breaks, adjust only its numeric bounds.

- [ ] **Step 1: Write the failing tests**

`functions/tests/test_fb_thresholds_guard.py`:

```python
import numpy as np

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.ai.risk import assess
from quantumsafe.ai.synthetic import generate_attack_events, generate_normal_events
from quantumsafe.fb.scoring import load_model, load_thresholds

NOW = 1_735_689_600.0
WIN = 300.0


def test_thresholds_file_is_well_formed_and_conservative():
    t = load_thresholds()
    assert 0.0 < t.elevated < t.high < t.critical <= 1.0
    assert t.critical >= 0.75, "auto-block threshold must stay conservative"


def test_calibration_targets_still_hold():
    model = load_model()
    t = load_thresholds()
    rng = np.random.default_rng(2024)

    normal_bands = []
    for i in range(300):
        ev = generate_normal_events(rng, f"n{i}", NOW, WIN)
        f = extract_features(ev, now=NOW, window_seconds=WIN)
        normal_bands.append(assess(f, model.raw_score(features_to_vector(f)), t).band)
    normal_ok = sum(b == "NORMAL" for b in normal_bands) / len(normal_bands)
    normal_high = sum(b in ("HIGH", "CRITICAL") for b in normal_bands) / len(normal_bands)
    assert normal_ok >= 0.80
    assert normal_high <= 0.05

    for kind in ("brute_force", "msg_flood", "off_hours_burst"):
        hits = 0
        for i in range(60):
            ev = generate_attack_events(rng, f"a{i}", NOW, WIN, kind=kind)
            f = extract_features(ev, now=NOW, window_seconds=WIN)
            band = assess(f, model.raw_score(features_to_vector(f)), t).band
            hits += band in ("HIGH", "CRITICAL")
        assert hits / 60 >= 0.85, f"{kind} detection rate too low"
```

`functions/tests/test_fb_scoring.py`:

```python
import time

from quantumsafe.fb import events, repo, scoring
from quantumsafe.security.events import LOGIN_FAIL, SIM_ATTACK


def test_rescore_writes_riskscores_and_returns_previous_band(db):
    now = time.time()
    events.record_event(db, "u1", "MSG_SENT", {"size": 20, "recipient": "u2"})

    assessment, previous = scoring.rescore_user(db, "u1", now=now + 2)
    assert previous == "NORMAL"
    stored = repo.get(db, "riskScores", "u1")
    assert stored["band"] == assessment.band
    assert 0.0 <= stored["score"] <= 1.0

    for _ in range(12):
        events.record_event(db, "u1", LOGIN_FAIL)
    events.record_event(db, "u1", SIM_ATTACK, {"kind": "brute_force"})
    hot, prev2 = scoring.rescore_user(db, "u1", now=time.time() + 2)
    assert prev2 == assessment.band
    assert hot.band in ("HIGH", "CRITICAL")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest functions/tests/test_fb_scoring.py functions/tests/test_fb_thresholds_guard.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.scoring'`.

- [ ] **Step 3: Re-tune and implement**

Edit `scripts/seed_baseline.py` — in the threshold tuner, replace the `critical` line so it never drops below `0.78`:

```python
critical = max(0.78, _budget_bound(normal_scores, 0.999) + 0.01, p99_9_normal + 0.01)
```

(Match the surrounding variable names actually present in the file; the intent is a hard `0.78` floor on `critical`.) Then:

```bash
python scripts/seed_baseline.py --out functions --users 500 --seed 42 --now 1735689600
```

`functions/quantumsafe/fb/scoring.py`:

```python
"""Recompute a user's behavioural risk from their recent security events."""

from __future__ import annotations

import json
import time
from functools import lru_cache

from quantumsafe.ai.features import DEFAULT_WINDOW_SECONDS, extract_features, features_to_vector
from quantumsafe.ai.model import RiskModel
from quantumsafe.ai.risk import RiskAssessment, Thresholds, assess
from quantumsafe.fb import events, repo
from quantumsafe.fb.config import model_path, thresholds_path


def load_thresholds() -> Thresholds:
    with open(thresholds_path(), encoding="utf-8") as fh:
        return Thresholds.from_dict(json.load(fh))


@lru_cache(maxsize=1)
def load_model() -> RiskModel:
    return RiskModel.load(model_path())


def rescore_user(db, uid: str, now: float | None = None) -> tuple[RiskAssessment, str]:
    now = time.time() if now is None else now
    window = load_events_window_for(db, uid, now)
    feats = extract_features(window, now=now, window_seconds=DEFAULT_WINDOW_SECONDS)
    model_score = load_model().raw_score(features_to_vector(feats))
    assessment = assess(feats, model_score, load_thresholds())

    previous = (repo.get(db, "riskScores", uid) or {}).get("band", "NORMAL")
    repo.set(
        db,
        "riskScores",
        uid,
        {
            "score": assessment.score,
            "band": assessment.band,
            "modelScore": assessment.model_score,
            "ruleBoost": assessment.rule_boost,
            "components": assessment.components,
            "updatedAt": repo.SERVER_TIMESTAMP,
        },
    )
    return assessment, previous


def load_events_window_for(db, uid: str, now: float):
    return events.load_events_window(db, uid, now, DEFAULT_WINDOW_SECONDS)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest functions/tests/test_fb_scoring.py functions/tests/test_fb_thresholds_guard.py -v`
Then the Part 1 suite still green: `python -m pytest functions/tests/test_synthetic.py functions/tests/test_risk.py -v`
Expected: all PASS. If `test_synthetic.py::test_training_matrix_shape_and_model_separates_attacks` fails on a numeric bound, adjust only that number and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_baseline.py functions/model.joblib functions/thresholds.json functions/quantumsafe/fb/scoring.py functions/tests/test_fb_scoring.py functions/tests/test_fb_thresholds_guard.py functions/tests/test_synthetic.py
git commit -m "feat(fb): risk rescoring + conservative CRITICAL threshold + guard test"
```

---

### Task 10: `fb.enforcement`

**Files:**
- Create: `functions/quantumsafe/fb/enforcement.py`
- Create: `functions/tests/test_fb_enforcement.py`

**Interfaces:**
- Consumes: `fb.repo`, `fb.client.get_auth`, `fb.config.collection`, `quantumsafe.security.policy` (`decide`, `STATUS_FOR`).
- Produces:
  - `apply_policy(db, uid: str, assessment, previous_band: str) -> PolicyAction` — computes `decide(previous_band, assessment.band)`. Always ensures `users/{uid}.status == action.status` and the Auth custom claim `status` matches. When `action.action != "NONE"`: writes `policyActions/{auto}` `{uid, fromBand, toBand, action, actor:"system", ts}`. When `action.terminate_sessions`: sets every `query_active_sessions_for(db, uid)` session `state="terminated"` and calls `auth.revoke_refresh_tokens(uid)`. When `action.raise_alert`: writes `alerts/{auto}` `{uid, reason, ts, acknowledged: False}`.
  - `set_status(db, uid: str, status: str, *, actor: str) -> None` — used by the admin callable; sets `users/{uid}.status`, the Auth claim, and a `policyActions` row with the given `actor`. If `status == "normal"`, also flips any `terminated` sessions? No — leave sessions; just clears the block.

- [ ] **Step 1: Write the failing test**

`functions/tests/test_fb_enforcement.py`:

```python
import pytest

from quantumsafe.ai.risk import RiskAssessment
from quantumsafe.fb import enforcement, identity, repo
from quantumsafe.fb.client import get_auth
from quantumsafe.fb.config import app_secret

SECRET = app_secret()


def _assessment(band: str, score: float) -> RiskAssessment:
    return RiskAssessment(score=score, band=band, model_score=score, rule_boost=0.0, components={})


@pytest.fixture
def auth_user(db):
    auth = get_auth()
    user = auth.create_user()
    identity.provision_user(db, user.uid, SECRET)
    yield user.uid
    try:
        auth.delete_user(user.uid)
    except Exception:
        pass


def test_escalation_to_high_terminates_sessions_and_sets_claim(db, auth_user):
    uid = auth_user
    repo.add(db, "sessions", {"participants": [uid, "peer"], "state": "active"})

    action = enforcement.apply_policy(db, uid, _assessment("HIGH", 0.7), "NORMAL")
    assert action.action == "TERMINATE_SESSIONS"

    assert repo.get(db, "users", uid)["status"] == "high"
    assert get_auth().get_user(uid).custom_claims.get("status") == "high"
    sess = enforcement.repo.query_active_sessions_for(db, uid)
    assert sess == []
    assert any(p["toBand"] == "HIGH" for p in _all(db, "policyActions"))


def test_critical_raises_alert(db, auth_user):
    action = enforcement.apply_policy(db, auth_user, _assessment("CRITICAL", 0.9), "HIGH")
    assert action.action == "BLOCK"
    assert repo.get(db, "users", auth_user)["status"] == "blocked"
    assert any(a["uid"] == auth_user for a in _all(db, "alerts"))


def test_same_band_is_noop_but_syncs_status(db, auth_user):
    action = enforcement.apply_policy(db, auth_user, _assessment("NORMAL", 0.1), "NORMAL")
    assert action.action == "NONE"
    assert repo.get(db, "users", auth_user)["status"] == "normal"
    assert _all(db, "policyActions") == []


def test_admin_set_status_normal_clears_block(db, auth_user):
    enforcement.apply_policy(db, auth_user, _assessment("CRITICAL", 0.9), "HIGH")
    enforcement.set_status(db, auth_user, "normal", actor="admin")
    assert repo.get(db, "users", auth_user)["status"] == "normal"
    assert get_auth().get_user(auth_user).custom_claims.get("status") == "normal"
    assert any(p["actor"] == "admin" for p in _all(db, "policyActions"))


def _all(db, base):
    from quantumsafe.fb.config import collection
    return [d.to_dict() for d in db.collection(collection(base)).stream()]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_fb_enforcement.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.fb.enforcement'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/fb/enforcement.py`:

```python
"""Apply an adaptive-security PolicyAction to Firestore + Firebase Auth."""

from __future__ import annotations

from quantumsafe.fb import repo
from quantumsafe.fb.client import get_auth
from quantumsafe.fb.config import collection
from quantumsafe.security.policy import STATUS_FOR, decide


def _sync_claim(uid: str, status: str) -> None:
    auth = get_auth()
    existing = dict(auth.get_user(uid).custom_claims or {})
    if existing.get("status") != status:
        existing["status"] = status
        auth.set_custom_user_claims(uid, existing)


def _terminate_sessions(db, uid: str) -> None:
    for sid, _ in repo.query_active_sessions_for(db, uid):
        db.collection(collection("sessions")).document(sid).update({"state": "terminated"})
    get_auth().revoke_refresh_tokens(uid)


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_fb_enforcement.py -v`
Expected: PASS (4 tests). These create and delete real Firebase Auth users — make sure the teardown in the fixture runs (`auth.delete_user`).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/fb/enforcement.py functions/tests/test_fb_enforcement.py
git commit -m "feat(fb): policy enforcement against Firestore and Firebase Auth"
```

---

### Task 11: `main.py` entrypoint — 7 callables + the trigger

**Files:**
- Create: `functions/main.py`
- Create: `functions/tests/test_main_wiring.py`

**Interfaces:**
- Consumes: everything in `fb/`.
- Produces the deployable functions (all `region=config.REGION`, `secrets=[APP_SECRET]`; trigger also `database=config.DATABASE`):
  - `register_keys`, `establish_session`, `send_message`, `read_message`, `reauth`, `simulate_attack`, `admin_set_status` — `@https_fn.on_call`
  - `on_security_event_created` — `@firestore_fn.on_document_created(document="securityEvents/{eventId}", ...)`
- Helper `_require_auth(req) -> str` returns `req.auth.uid` or raises `HttpsError(UNAUTHENTICATED)`.
- `reauth` verifies the password against the Identity Toolkit REST endpoint using the project's web API key (`WEB_API_KEY = SecretParam("WEB_API_KEY")` OR a plain module constant — use the constant `"AIzaSyCKr9ISLAHwCKCMcmrgGhxpxBa7dSKqYYA"` from the known web config, since web API keys are not secret). On success: `repo.merge(users, uid, {"reauthAt": SERVER_TIMESTAMP})`, `record_event(RE_AUTH_OK)`. On failure: `record_event(RE_AUTH_FAIL)`, raise `AppError(REAUTH_REQUIRED, ...)`.

- [ ] **Step 1: Write the failing test**

`functions/tests/test_main_wiring.py`:

```python
import importlib


def test_all_endpoints_exist_and_are_callables():
    main = importlib.import_module("main")
    for name in [
        "register_keys", "establish_session", "send_message", "read_message",
        "reauth", "simulate_attack", "admin_set_status", "on_security_event_created",
    ]:
        assert callable(getattr(main, name)), name


def test_endpoints_are_configured_for_asia_south1_and_default2():
    main = importlib.import_module("main")
    # firebase-functions 0.6.0 attaches a `__firebase_endpoint__` ManifestEndpoint
    # (verified: `.region` is a list, trigger `.eventTrigger` is a dict).
    reg = main.register_keys.__firebase_endpoint__
    assert reg.region == ["asia-south1"]

    trig = main.on_security_event_created.__firebase_endpoint__
    assert trig.region == ["asia-south1"]
    assert trig.eventTrigger["eventFilters"]["database"] == "default2"


def test_reauth_helper_maps_bad_password(monkeypatch):
    main = importlib.import_module("main")
    monkeypatch.setattr(main, "_verify_password", lambda email, pw: False)
    assert main._verify_password("x@y.com", "bad") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_main_wiring.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'main'`.

- [ ] **Step 3: Write minimal implementation**

`functions/main.py`:

```python
"""Cloud Functions entrypoint. Thin: auth-guard, delegate to fb/, map errors."""

from __future__ import annotations

import json
import time
import urllib.request

import firebase_admin
from firebase_functions import firestore_fn, https_fn
from firebase_functions.params import SecretParam

from quantumsafe.fb import enforcement, identity, messaging, scoring, sessions
from quantumsafe.fb import events as fb_events
from quantumsafe.fb.client import get_db
from quantumsafe.fb.config import DATABASE, REGION, app_secret
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
    db.collection.__self__  # noqa: B018  (keep import of db meaningful)
    from quantumsafe.fb import repo

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
```

> Implementer note: the `db.collection.__self__` line above is a mistake — delete it. Keep `reauth` importing `repo` at the top of the function or module level; the intent is only: on success, set `reauthAt`, record `RE_AUTH_OK`, rescore, apply policy.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_main_wiring.py -v`
Then the whole suite: `python -m pytest -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/main.py functions/tests/test_main_wiring.py
git commit -m "feat(fb): Cloud Functions entrypoint - 7 callables + risk trigger"
```

---

### Task 12: Admin bootstrap script + deploy + live trigger smoke test

**Files:**
- Create: `scripts/grant_admin.py`
- Create: `scripts/smoke_live.py`
- Create: `docs/part2-deploy.md`

**Interfaces:**
- Consumes: `fb.client`, `fb.repo`.
- Produces:
  - `scripts/grant_admin.py --uid U | --email E` — sets Auth custom claim `role=admin` (preserving `status`) and `users/{uid}.role="admin"`
  - `scripts/smoke_live.py` — against the deployed project: writes one `securityEvents` doc for a throwaway uid directly to `default2` (no prefix), polls `riskScores/{uid}` for up to 120 s, asserts it appears (proving the deployed `on_security_event_created` ran), then deletes both docs. Exits non-zero on timeout.

- [ ] **Step 1: Write `scripts/grant_admin.py`**

```python
"""Grant a user the admin role (custom claim + users doc). Usage:
    python scripts/grant_admin.py --email you@example.com
    python scripts/grant_admin.py --uid <firebase-uid>
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

from quantumsafe.fb import repo                     # noqa: E402
from quantumsafe.fb.client import get_auth, get_db  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--uid")
    g.add_argument("--email")
    args = ap.parse_args()

    auth = get_auth()
    user = auth.get_user(args.uid) if args.uid else auth.get_user_by_email(args.email)
    claims = dict(user.custom_claims or {})
    claims["role"] = "admin"
    claims.setdefault("status", "normal")
    auth.set_custom_user_claims(user.uid, claims)
    repo.merge(get_db(), "users", user.uid, {"role": "admin"})
    print(f"granted admin to {user.uid} ({user.email})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write `scripts/smoke_live.py`**

```python
"""Post-deploy check: prove the deployed on_security_event_created trigger runs.

Writes a real securityEvents doc to default2 (NO test prefix), waits for the
deployed function to write riskScores/<uid>, then cleans up.
"""

from __future__ import annotations

import os
import sys
import time
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

os.environ.pop("QS_COLLECTION_PREFIX", None)  # hit real collections

from quantumsafe.fb.client import get_db  # noqa: E402
from quantumsafe.fb import repo            # noqa: E402


def main() -> int:
    db = get_db()
    uid = f"smoke-{uuid.uuid4().hex[:8]}"
    eid = repo.add(db, "securityEvents", {"uid": uid, "type": "SIM_ATTACK", "meta": {"kind": "brute_force"}, "ts": repo.SERVER_TIMESTAMP})
    print(f"wrote securityEvents/{eid} for {uid}; waiting for trigger...")

    deadline = time.time() + 120
    ok = False
    while time.time() < deadline:
        if repo.get(db, "riskScores", uid) is not None:
            ok = True
            break
        time.sleep(5)

    # cleanup
    from quantumsafe.fb.config import collection
    db.collection(collection("securityEvents")).document(eid).delete()
    if repo.get(db, "riskScores", uid) is not None:
        db.collection(collection("riskScores")).document(uid).delete()

    print("TRIGGER OK" if ok else "TRIGGER TIMEOUT")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Write `docs/part2-deploy.md`**

Document, in order:
1. `pip install -r functions/requirements.txt`
2. Set the secret: `firebase functions:secrets:set APP_SECRET` (paste a long random string; note the same value must be used if the DB ever needs re-derivation — store it in a password manager).
3. Deploy indexes: `firebase deploy --only firestore:indexes`
4. Deploy functions: `firebase deploy --only functions` (first deploy enables required Google APIs — may take several minutes; it also prompts to enable Artifact Registry / Cloud Build / Cloud Run — accept).
5. Verify: `python scripts/smoke_live.py` → expect `TRIGGER OK`.
6. Grant yourself admin: `python scripts/grant_admin.py --email <your login email>`.

- [ ] **Step 4: Deploy and run the live smoke test**

```bash
python -m pip install -r functions/requirements.txt
firebase deploy --only firestore:indexes,functions
python scripts/smoke_live.py
```

Expected: deploy succeeds; `smoke_live.py` prints `TRIGGER OK` and exits 0. If deploy fails on secrets, run `firebase functions:secrets:set APP_SECRET` first. If the trigger times out, check `firebase functions:log` for `on_security_event_created` errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/grant_admin.py scripts/smoke_live.py docs/part2-deploy.md
git commit -m "feat(fb): admin bootstrap script, live smoke test, deploy runbook"
```

---

## Self-Review

**Spec coverage (§ = design spec):**
- §3.1 Cloud Functions for Firebase, Python 3.12, region → Tasks 1, 11.
- §3.2 Firestore data model — `users`, `publicKeys`, `privateKeys`, `sessions`, `messages`, `securityEvents`, `riskScores`, `policyActions`, `alerts` → Tasks 4–10 write exactly these; ciphertext-only messages verified in Task 8's test.
- §3.3 callables: `register_keys` (T11/T6), `establish_session` (T11/T7), `send_message` (T11/T8), `read_message` (T11/T8), `reauth` (T11), `simulate_attack` (T11), `admin_set_status` (T11/T10); trigger `on_security_event_created` (T11/T9/T10).
- §3.3 KEK from a server-held secret → `APP_SECRET` SecretParam (T2, T11); private keys encrypted at rest → Part 1 `keystore`, stored by T6.
- §3.4 feature rebuild → Isolation Forest → blended risk → `riskScores` → T9.
- §3.5 policy state machine + actions (claim, terminate sessions, alert, admin restore) → T10; the `send_message` band gate (blocked / elevated-needs-reauth) → T8.
- §3.7 security rules → explicitly deferred to Part 3; T1 ships a deny-all placeholder.
- Carry-forward (from Part 1 ledger): `thresholds.json` guard test → T9 (`test_fb_thresholds_guard.py`); raise the auto-block threshold → T9 (CRITICAL floored at 0.78, guard asserts ≥ 0.75).

**Placeholder scan:** No "TBD"/"handle errors"/"similar to". Two deliberate implementer notes are called out inline: Task 11's `db.collection.__self__` line is explicitly flagged for deletion, and the endpoint-manifest attribute name in `test_main_wiring.py` is flagged as "verify the real name". Every other step has literal code.

**Type consistency:**
- `AppError(code, message)` + code constants — defined T3, used T6/T7/T8/T10/T11, mapped in T3's `to_https_error`. `SESSION_INACTIVE` added in T7 to the same module + `_MAP`. ✔
- `repo.get/set/merge/add/query_recent_events/query_active_sessions_for` + `repo.SERVER_TIMESTAMP` — defined T4, used T5–T11. ✔
- `record_event(db, uid, type, meta)` / `load_events_window(db, uid, now, window)` — defined T5, used T7/T8/T9/T11. ✔
- `identity.provision_user` returns `bool`; `load_kem_public/load_sign_public/load_sign_secret/load_kem_secret` — defined T6, used T7/T8. ✔
- `sessions.establish_session -> str`, `sessions.load_session_key -> bytes` — defined T7, used T8. `SESSION_INFO` local to T7. ✔
- `messaging.send_message -> str (message id)`, `read_message -> str (plaintext)` — defined T8, used T11. ✔
- `scoring.rescore_user(db, uid, now=None) -> (RiskAssessment, previous_band)` — defined T9, used T10-via-T11 and T11. `load_thresholds`/`load_model` — defined T9, used T9's guard test. ✔
- `enforcement.apply_policy(db, uid, assessment, previous_band) -> PolicyAction`, `enforcement.set_status(db, uid, status, *, actor)` — defined T10, used T11. Consumes `RiskAssessment` fields `.score/.band/.model_score/.rule_boost/.components` (Part 1) and `PolicyAction` fields `.action/.status/.from_band/.to_band/.terminate_sessions/.raise_alert` (Part 1). ✔
- `config.collection/app_secret/REGION/DATABASE/model_path/thresholds_path` — defined T2, used throughout. ✔
- `client.get_db()/get_auth()` — defined T2, used T2/T10/T11/T12. ✔

No gaps found within this plan's scope. Firestore-security-rules and the React client are correctly out of scope (Parts 3–4).
