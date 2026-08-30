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
