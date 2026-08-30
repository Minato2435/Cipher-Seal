import time

from quantumsafe.ai.risk import RiskAssessment
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


def test_dead_model_degrades_to_rule_only_score(db, monkeypatch):
    def _boom():
        raise RuntimeError("model.joblib unreadable (sklearn version drift)")

    monkeypatch.setattr(scoring, "load_model", _boom)

    assessment, previous = scoring.rescore_user(db, "u-dead-model", now=time.time() + 2)

    assert isinstance(assessment, RiskAssessment)
    assert assessment.model_score == 0.0
    assert assessment.band == "NORMAL"
    stored = repo.get(db, "riskScores", "u-dead-model")
    assert stored is not None
    assert stored["band"] == "NORMAL"
    assert stored["modelScore"] == 0.0
