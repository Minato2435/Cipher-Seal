"""Turn a window of security events into a fixed-order numeric feature vector."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone

from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)

FEATURE_NAMES = [
    "login_fail_count",
    "login_fail_rate",
    "msg_sent_count",
    "msg_rate_per_min",
    "mean_msg_interval_s",
    "msg_size_mean",
    "distinct_recipients",
    "session_count",
    "hour_of_day_sin",
    "hour_of_day_cos",
    "sim_attack_flag",
]

DEFAULT_WINDOW_SECONDS = 300.0


def extract_features(
    events: Sequence[SecurityEvent],
    *,
    now: float,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
) -> dict[str, float]:
    start = now - window_seconds
    win = [e for e in events if start <= e.ts <= now]
    minutes = window_seconds / 60.0

    login_fail = [e for e in win if e.type == LOGIN_FAIL]
    msgs = sorted((e for e in win if e.type == MSG_SENT), key=lambda e: e.ts)
    sessions = [e for e in win if e.type == SESSION_ESTABLISH]

    sizes = [float(e.meta.get("size", 0) or 0) for e in msgs]
    recipients = {e.meta.get("recipient") for e in msgs if e.meta.get("recipient")}

    if len(msgs) >= 2:
        gaps = [b.ts - a.ts for a, b in zip(msgs, msgs[1:])]
        mean_interval = sum(gaps) / len(gaps)
    else:
        mean_interval = 0.0

    hour = datetime.fromtimestamp(now, tz=timezone.utc).hour
    angle = 2.0 * math.pi * hour / 24.0

    return {
        "login_fail_count": float(len(login_fail)),
        "login_fail_rate": len(login_fail) / minutes,
        "msg_sent_count": float(len(msgs)),
        "msg_rate_per_min": len(msgs) / minutes,
        "mean_msg_interval_s": float(mean_interval),
        "msg_size_mean": (sum(sizes) / len(sizes)) if sizes else 0.0,
        "distinct_recipients": float(len(recipients)),
        "session_count": float(len(sessions)),
        "hour_of_day_sin": math.sin(angle),
        "hour_of_day_cos": math.cos(angle),
        "sim_attack_flag": 1.0 if any(e.type == SIM_ATTACK for e in win) else 0.0,
        "hour_of_day": float(hour),
    }


def features_to_vector(feats: Mapping[str, float]) -> list[float]:
    return [float(feats[name]) for name in FEATURE_NAMES]
