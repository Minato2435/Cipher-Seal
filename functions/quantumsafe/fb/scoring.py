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


@lru_cache(maxsize=1)
def load_thresholds() -> Thresholds:
    """Cached like ``load_model``: regenerating ``thresholds.json`` on disk
    requires a process restart (a redeploy in Cloud Functions) to take effect."""
    with open(thresholds_path(), encoding="utf-8") as fh:
        return Thresholds.from_dict(json.load(fh))


@lru_cache(maxsize=1)
def load_model() -> RiskModel:
    return RiskModel.load(model_path())


def rescore_user(db, uid: str, now: float | None = None) -> tuple[RiskAssessment, str]:
    now = time.time() if now is None else now
    window = events.load_events_window(db, uid, now, DEFAULT_WINDOW_SECONDS)
    # load_events_window tolerates a little clock skew (Firestore's commit clock
    # runs ahead of ours), so a just-written event can sit a few hundred ms past
    # `now`. extract_features applies its own `ts <= now` cut, so advance the
    # feature clock to the newest event we actually have — otherwise a rescore
    # fired straight after a write silently drops its most recent events.
    if window:
        now = max(now, max(e.ts for e in window))
    feats = extract_features(window, now=now, window_seconds=DEFAULT_WINDOW_SECONDS)
    try:
        model_score = load_model().raw_score(features_to_vector(feats))
    except Exception as exc:  # noqa: BLE001 - a dead model must not kill scoring
        # Spec 4: retry once, then log and fall back to a degraded, rule-only
        # score. `model_score = 0.0` leaves `rule_boost * 0.4`, so the
        # deterministic rule signals still escalate an account.
        try:
            load_model.cache_clear()
            model_score = load_model().raw_score(features_to_vector(feats))
        except Exception as exc2:  # noqa: BLE001
            print(
                f"rescore_user: risk model unavailable for {uid}, "
                f"degrading to rule-only score ({exc!r} / retry {exc2!r})"
            )
            model_score = 0.0

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
