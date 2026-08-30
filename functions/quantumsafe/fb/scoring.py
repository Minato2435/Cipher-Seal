"""Recompute a user's behavioural risk from their recent security events."""

from __future__ import annotations

import json
import time
from functools import lru_cache

from quantumsafe.ai.features import DEFAULT_WINDOW_SECONDS, extract_features, features_to_vector
from quantumsafe.ai.model import RiskModel
from quantumsafe.ai.risk import RiskAssessment, Thresholds, assess
from quantumsafe.fb import events, repo
from quantumsafe.fb.config import model_path, thresholds_path


def load_thresholds() -> Thresholds:
    with open(thresholds_path(), encoding="utf-8") as fh:
        return Thresholds.from_dict(json.load(fh))


@lru_cache(maxsize=1)
def load_model() -> RiskModel:
    return RiskModel.load(model_path())


def rescore_user(db, uid: str, now: float | None = None) -> tuple[RiskAssessment, str]:
    now = time.time() if now is None else now
    window = events.load_events_window(db, uid, now, DEFAULT_WINDOW_SECONDS)
    feats = extract_features(window, now=now, window_seconds=DEFAULT_WINDOW_SECONDS)
    model_score = load_model().raw_score(features_to_vector(feats))
    assessment = assess(feats, model_score, load_thresholds())

    previous = (repo.get(db, "riskScores", uid) or {}).get("band", "NORMAL")
    repo.set(
        db,
        "riskScores",
        uid,
        {
            "score": assessment.score,
            "band": assessment.band,
            "modelScore": assessment.model_score,
            "ruleBoost": assessment.rule_boost,
            "components": assessment.components,
            "updatedAt": repo.SERVER_TIMESTAMP,
        },
    )
    return assessment, previous
