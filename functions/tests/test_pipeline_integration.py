import base64
import time

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.ai.model import RiskModel
from quantumsafe.ai.risk import Thresholds, assess
from quantumsafe.security.events import LOGIN_FAIL, SIM_ATTACK, SecurityEvent
from quantumsafe.security.policy import decide
from quantumsafe.pipeline import secure_exchange

SECRET = b"integration-secret-integration!!"


def test_full_crypto_path_round_trips_and_verifies():
    out = secure_exchange(SECRET, b"the eagle lands at midnight")
    assert out["verified"] is True
    assert out["recovered"] == b"the eagle lands at midnight"
    assert out["ct_b64"] and out["sig_b64"]
    # plaintext must not survive into the transported ciphertext
    assert b"eagle" not in base64.b64decode(out["ct_b64"])
    # the session-key fingerprint is a stable 16-hex-char digest
    assert len(out["session_key_fp"]) == 16
    int(out["session_key_fp"], 16)


def test_risk_pipeline_drives_policy_from_normal_to_critical():
    now = time.time()
    # need a trained model artefact from Task 12
    model = RiskModel.load("functions/model.joblib")
    thresholds = Thresholds()

    quiet = extract_features([], now=now)
    quiet_band = assess(quiet, model.raw_score(features_to_vector(quiet)), thresholds).band

    attack_events = (
        [SecurityEvent("u1", LOGIN_FAIL, now - i) for i in range(12)]
        + [SecurityEvent("u1", SIM_ATTACK, now - 1, meta={"kind": "brute_force"})]
    )
    hot = extract_features(attack_events, now=now)
    hot_assess = assess(hot, model.raw_score(features_to_vector(hot)), thresholds)

    assert quiet_band == "NORMAL"
    assert hot_assess.band in ("HIGH", "CRITICAL")

    action = decide(quiet_band, hot_assess.band)
    assert action.terminate_sessions is True
