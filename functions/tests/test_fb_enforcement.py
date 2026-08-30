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
