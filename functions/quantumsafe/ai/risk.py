"""Blend the model's anomaly score with hard rule signals, then assign a band."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

BANDS = ("NORMAL", "ELEVATED", "HIGH", "CRITICAL")

_MSG_RATE_LIMIT = 30.0
_MODEL_WEIGHT = 0.6
_RULE_WEIGHT = 0.4


@dataclass(frozen=True)
class Thresholds:
    elevated: float = 0.35
    high: float = 0.60
    critical: float = 0.80

    def to_dict(self) -> dict:
        return {"elevated": self.elevated, "high": self.high, "critical": self.critical}

    @classmethod
    def from_dict(cls, d: Mapping[str, float]) -> "Thresholds":
        return cls(
            elevated=float(d["elevated"]),
            high=float(d["high"]),
            critical=float(d["critical"]),
        )


@dataclass(frozen=True)
class RiskAssessment:
    score: float
    band: str
    model_score: float
    rule_boost: float
    components: dict = field(default_factory=dict)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def rule_boost(feats: Mapping[str, float]) -> tuple[float, dict]:
    components: dict[str, float] = {}
    if feats.get("login_fail_count", 0.0) >= 5:
        components["brute_force"] = 0.40
    if feats.get("msg_rate_per_min", 0.0) > _MSG_RATE_LIMIT:
        components["msg_flood"] = 0.30
    # hour_of_day is UTC (from features.extract_features); "off-hours" here means 00:00-06:00 UTC
    if feats.get("hour_of_day", 12.0) < 6 and feats.get("msg_sent_count", 0.0) > 10:
        components["off_hours_burst"] = 0.20
    if feats.get("sim_attack_flag", 0.0) >= 1.0:
        components["sim_attack"] = 0.30
    return _clamp(sum(components.values())), components


def blended_score(model_score: float, boost: float) -> float:
    return _clamp(_MODEL_WEIGHT * model_score + _RULE_WEIGHT * boost)


def band_for(score: float, thresholds: Thresholds) -> str:
    if score >= thresholds.critical:
        return "CRITICAL"
    if score >= thresholds.high:
        return "HIGH"
    if score >= thresholds.elevated:
        return "ELEVATED"
    return "NORMAL"


def assess(
    feats: Mapping[str, float],
    model_score: float,
    thresholds: Thresholds,
) -> RiskAssessment:
    boost, components = rule_boost(feats)
    score = blended_score(model_score, boost)
    return RiskAssessment(
        score=score,
        band=band_for(score, thresholds),
        model_score=float(model_score),
        rule_boost=boost,
        components=components,
    )
