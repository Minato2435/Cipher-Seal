import numpy as np

from quantumsafe.ai.model import RiskModel, train_model


def _normal_data(seed=0, n=400):
    rng = np.random.default_rng(seed)
    # 4-dim blob centred at origin
    return rng.normal(0.0, 1.0, size=(n, 4)).tolist()


def test_train_returns_model_and_scores_in_unit_interval():
    model = train_model(_normal_data(), random_state=42)
    s = model.raw_score([0.0, 0.0, 0.0, 0.0])
    assert 0.0 <= s <= 1.0


def test_outlier_scores_higher_than_inlier():
    model = train_model(_normal_data(), random_state=42)
    inlier = model.raw_score([0.1, -0.2, 0.0, 0.05])
    outlier = model.raw_score([12.0, -11.0, 9.0, 10.0])
    assert outlier > inlier


def test_save_and_load_roundtrip(tmp_path):
    model = train_model(_normal_data(), random_state=42)
    p = tmp_path / "m.joblib"
    model.save(str(p))
    loaded = RiskModel.load(str(p))
    v = [0.3, 0.3, 0.3, 0.3]
    assert abs(loaded.raw_score(v) - model.raw_score(v)) < 1e-9
