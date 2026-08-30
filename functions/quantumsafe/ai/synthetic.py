"""Synthetic security-event generators used to bootstrap the risk model."""

from __future__ import annotations

import numpy as np

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.security.events import (
    LOGIN_FAIL,
    LOGIN_OK,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)

# How far back the synthetic baseline spreads its windows, so the model sees
# normal traffic at every hour of the day rather than one instant.
_TRAINING_SPAN_HOURS = 14 * 24
# Fraction of baseline users whose window contains no events at all.
_IDLE_FRACTION = 0.35


def _spread(rng, now: float, window: float, n: int) -> list[float]:
    if n <= 0:
        return []
    return sorted(now - window + rng.random(n) * window)


def generate_normal_events(rng, uid: str, now: float, window_seconds: float) -> list[SecurityEvent]:
    events: list[SecurityEvent] = []
    events.append(SecurityEvent(uid, LOGIN_OK, now - window_seconds + 1.0))
    if rng.random() < 0.3:
        events.append(SecurityEvent(uid, LOGIN_FAIL, now - window_seconds + 0.5))
    events.append(SecurityEvent(uid, SESSION_ESTABLISH, now - window_seconds + 2.0))

    n_msgs = int(rng.integers(2, 12))
    peers = ["p1", "p2", "p3"]
    for ts in _spread(rng, now, window_seconds, n_msgs):
        events.append(
            SecurityEvent(
                uid,
                MSG_SENT,
                ts,
                meta={"size": int(rng.integers(20, 400)), "recipient": peers[int(rng.integers(0, len(peers)))]},
            )
        )
    return events


def generate_attack_events(
    rng, uid: str, now: float, window_seconds: float, kind: str
) -> list[SecurityEvent]:
    events: list[SecurityEvent] = []
    if kind == "brute_force":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(8, 20))):
            events.append(SecurityEvent(uid, LOGIN_FAIL, ts))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    elif kind == "msg_flood":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(200, 400))):
            events.append(SecurityEvent(uid, MSG_SENT, ts, meta={"size": 20, "recipient": "victim"}))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    elif kind == "off_hours_burst":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(20, 60))):
            events.append(SecurityEvent(uid, MSG_SENT, ts, meta={"size": 50, "recipient": "x"}))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    else:  # pragma: no cover - guarded by callers
        raise ValueError(f"unknown attack kind: {kind!r}")
    return events


def build_training_matrix(rng, n_users: int, now: float, window_seconds: float) -> list[list[float]]:
    """Assemble a matrix of *normal* feature vectors to fit the baseline model.

    Real baseline traffic is not uniform: some windows are busy, some are quiet
    (a user who sent nothing), and normal activity happens at every hour of the
    day. We therefore spread each synthetic user across a two-week span of hours
    and let a fraction of them be near-idle, so the model learns that "little or
    no activity" is ordinary rather than anomalous.
    """
    rows: list[list[float]] = []
    for i in range(n_users):
        user_now = now - float(rng.integers(0, _TRAINING_SPAN_HOURS)) * 3600.0
        if rng.random() < _IDLE_FRACTION:
            ev: list[SecurityEvent] = []
        else:
            ev = generate_normal_events(rng, f"u{i}", user_now, window_seconds)
        feats = extract_features(ev, now=user_now, window_seconds=window_seconds)
        rows.append(features_to_vector(feats))
    return rows
