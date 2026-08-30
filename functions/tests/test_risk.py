import pytest

from quantumsafe.ai.risk import (
    BANDS,
    RiskAssessment,
    Thresholds,
    assess,
    band_for,
    blended_score,
    rule_boost,
)

BASE = {
    "login_fail_count": 0.0,
    "msg_rate_per_min": 0.0,
    "msg_sent_count": 0.0,
    "sim_attack_flag": 0.0,
    "hour_of_day": 13.0,
}


def test_no_signals_zero_boost():
    boost, comp = rule_boost(BASE)
    assert boost == 0.0
    assert comp == {}


def test_brute_force_boost():
    boost, comp = rule_boost({**BASE, "login_fail_count": 6.0})
    assert boost == pytest.approx(0.40)
    assert "brute_force" in comp


def test_multiple_signals_capped_at_one():
    feats = {
        **BASE,
        "login_fail_count": 9.0,     # +0.40
        "msg_rate_per_min": 45.0,    # +0.30
        "sim_attack_flag": 1.0,      # +0.30
        "hour_of_day": 3.0,
        "msg_sent_count": 20.0,      # off-hours burst +0.20
    }
    boost, _ = rule_boost(feats)
    assert boost == 1.0


def test_blended_score_formula_and_clamp():
    assert blended_score(0.5, 0.5) == pytest.approx(0.5)
    assert blended_score(1.0, 1.0) == 1.0
    assert blended_score(-3.0, -3.0) == 0.0


def test_band_boundaries():
    t = Thresholds()
    assert band_for(0.00, t) == "NORMAL"
    assert band_for(0.34, t) == "NORMAL"
    assert band_for(0.35, t) == "ELEVATED"
    assert band_for(0.60, t) == "HIGH"
    assert band_for(0.80, t) == "CRITICAL"
    assert band_for(0.99, t) in BANDS


def test_assess_bundles_everything():
    a = assess({**BASE, "login_fail_count": 6.0}, model_score=0.1, thresholds=Thresholds())
    assert isinstance(a, RiskAssessment)
    # model 0.1*0.6 = 0.06 ; boost 0.4*0.4 = 0.16 ; total 0.22 -> NORMAL
    assert a.band == "NORMAL"
    assert a.rule_boost == pytest.approx(0.40)
    assert "brute_force" in a.components


def test_thresholds_dict_round_trip():
    t = Thresholds(elevated=0.3, high=0.5, critical=0.7)
    assert Thresholds.from_dict(t.to_dict()) == t
