import numpy as np

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.ai.model import train_model
from quantumsafe.ai.risk import Thresholds, assess
from quantumsafe.ai.synthetic import (
    build_training_matrix,
    generate_attack_events,
    generate_normal_events,
)

NOW = 1_700_000_000.0
WIN = 300.0


def test_normal_events_are_modest_volume():
    rng = np.random.default_rng(0)
    ev = generate_normal_events(rng, "u1", NOW, WIN)
    feats = extract_features(ev, now=NOW, window_seconds=WIN)
    assert feats["login_fail_count"] <= 2
    assert feats["msg_rate_per_min"] < 10


def test_brute_force_attack_trips_rule_boost():
    rng = np.random.default_rng(1)
    ev = generate_attack_events(rng, "u1", NOW, WIN, kind="brute_force")
    feats = extract_features(ev, now=NOW, window_seconds=WIN)
    assert feats["login_fail_count"] >= 5


def test_training_matrix_shape_and_model_separates_attacks():
    rng = np.random.default_rng(42)
    matrix = build_training_matrix(rng, n_users=150, now=NOW, window_seconds=WIN)
    assert len(matrix) == 150
    assert all(len(row) == len(matrix[0]) for row in matrix)

    model = train_model(matrix, random_state=42)
    t = Thresholds()

    # a normal sample should usually land NORMAL/ELEVATED
    normal_ev = generate_normal_events(np.random.default_rng(7), "n", NOW, WIN)
    nf = extract_features(normal_ev, now=NOW, window_seconds=WIN)
    n_assess = assess(nf, model.raw_score(features_to_vector(nf)), t)
    assert n_assess.band in ("NORMAL", "ELEVATED")

    # a flood attack should reach at least HIGH (rule boost alone contributes 0.30)
    atk_ev = generate_attack_events(np.random.default_rng(8), "a", NOW, WIN, kind="msg_flood")
    af = extract_features(atk_ev, now=NOW, window_seconds=WIN)
    a_assess = assess(af, model.raw_score(features_to_vector(af)), t)
    assert a_assess.score > n_assess.score
    assert a_assess.band in ("HIGH", "CRITICAL")
