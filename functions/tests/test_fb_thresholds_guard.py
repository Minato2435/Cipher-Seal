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
