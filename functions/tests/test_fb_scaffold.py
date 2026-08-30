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
