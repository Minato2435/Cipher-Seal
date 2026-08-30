"""Isolation Forest wrapper that emits a stable 0..1 anomaly score.

The raw ``decision_function`` output is unbounded and model-specific, so at train
time we record the 5th/95th percentiles of ``-decision_function`` over the
training set and later min-max normalise against that range.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


@dataclass
class RiskModel:
    scaler: StandardScaler
    forest: IsolationForest
    p_low: float
    p_high: float

    def raw_score(self, vector: Sequence[float]) -> float:
        x = self.scaler.transform([list(vector)])
        anomaly = -float(self.forest.decision_function(x)[0])
        span = self.p_high - self.p_low
        if span <= 1e-12:
            return 0.0
        return float(np.clip((anomaly - self.p_low) / span, 0.0, 1.0))

    def save(self, path: str) -> None:
        joblib.dump(
            {
                "scaler": self.scaler,
                "forest": self.forest,
                "p_low": self.p_low,
                "p_high": self.p_high,
            },
            path,
        )

    @classmethod
    def load(cls, path: str) -> "RiskModel":
        # The artefact is a pickle, so loading it executes code. It is a
        # repo-controlled, trusted file produced by scripts/seed_baseline.py --
        # do not make this path externally configurable.
        d = joblib.load(path)
        return cls(scaler=d["scaler"], forest=d["forest"], p_low=d["p_low"], p_high=d["p_high"])


def train_model(
    normal_vectors: Sequence[Sequence[float]],
    *,
    contamination: float = 0.05,
    n_estimators: int = 200,
    random_state: int = 42,
) -> RiskModel:
    x_raw = np.asarray([list(v) for v in normal_vectors], dtype=float)
    scaler = StandardScaler().fit(x_raw)
    x = scaler.transform(x_raw)
    forest = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    ).fit(x)
    anomaly = -forest.decision_function(x)
    p_low = float(np.percentile(anomaly, 5))
    p_high = float(np.percentile(anomaly, 95))
    return RiskModel(scaler=scaler, forest=forest, p_low=p_low, p_high=p_high)
