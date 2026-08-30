import math

from quantumsafe.ai.features import (
    FEATURE_NAMES,
    extract_features,
    features_to_vector,
)
from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)

NOW = 1_000_000.0


def _ev(t, ts, **meta):
    return SecurityEvent(uid="u1", type=t, ts=ts, meta=meta)


def test_all_feature_names_present_and_vector_matches_order():
    feats = extract_features([], now=NOW)
    for name in FEATURE_NAMES:
        assert name in feats
    vec = features_to_vector(feats)
    assert len(vec) == len(FEATURE_NAMES)
    assert vec == [feats[n] for n in FEATURE_NAMES]


def test_events_outside_window_are_ignored():
    old = _ev(LOGIN_FAIL, NOW - 999)
    feats = extract_features([old], now=NOW, window_seconds=300.0)
    assert feats["login_fail_count"] == 0.0


def test_counts_rates_and_sizes():
    events = [
        _ev(LOGIN_FAIL, NOW - 200),
        _ev(LOGIN_FAIL, NOW - 100),
        _ev(MSG_SENT, NOW - 180, size=100, recipient="a"),
        _ev(MSG_SENT, NOW - 120, size=200, recipient="b"),
        _ev(MSG_SENT, NOW - 60, size=300, recipient="a"),
        _ev(SESSION_ESTABLISH, NOW - 90),
    ]
    feats = extract_features(events, now=NOW, window_seconds=300.0)
    assert feats["login_fail_count"] == 2.0
    assert feats["msg_sent_count"] == 3.0
    assert feats["msg_size_mean"] == 200.0
    assert feats["distinct_recipients"] == 2.0
    assert feats["session_count"] == 1.0
    assert math.isclose(feats["msg_rate_per_min"], 3.0 / 5.0, rel_tol=1e-6)
    assert math.isclose(feats["mean_msg_interval_s"], 60.0, rel_tol=1e-6)


def test_sim_attack_flag_and_hour_fields():
    feats = extract_features([_ev(SIM_ATTACK, NOW - 5)], now=NOW)
    assert feats["sim_attack_flag"] == 1.0
    assert 0 <= feats["hour_of_day"] <= 23
    assert math.isclose(
        feats["hour_of_day_sin"] ** 2 + feats["hour_of_day_cos"] ** 2, 1.0, rel_tol=1e-6
    )
