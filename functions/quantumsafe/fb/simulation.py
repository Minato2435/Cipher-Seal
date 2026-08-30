"""Demo-only: write a capped burst of synthetic security events for a user."""

from __future__ import annotations

import time

import numpy as np

from quantumsafe.ai.synthetic import generate_attack_events
from quantumsafe.fb.errors import INVALID_KIND, AppError
from quantumsafe.fb.events import record_event

_KINDS = {"brute_force", "msg_flood", "off_hours_burst"}
_MAX_EVENTS = 40


def run_simulated_attack(db, target_uid: str, kind: str) -> int:
    """Write a capped burst of synthetic security events for a demo.

    Returns the count written. The generator already appends its own trailing
    ``SIM_ATTACK`` marker, so this does not add another one.
    """
    if kind not in _KINDS:
        raise AppError(INVALID_KIND, f"unknown attack kind: {kind}")

    events = generate_attack_events(
        np.random.default_rng(), target_uid, time.time(), 300.0, kind=kind
    )
    # Cap the burst. The generator puts its SIM_ATTACK marker last, so keeping
    # the tail preserves exactly one SIM_ATTACK event.
    if len(events) > _MAX_EVENTS:
        events = events[-_MAX_EVENTS:]

    for ev in events:
        record_event(db, target_uid, ev.type, {**ev.meta, "simulated": True})

    # Score/enforce ONCE, synchronously, after the whole burst. The per-event
    # trigger firings race each other against a single riskScores doc, so the
    # end state would otherwise be non-deterministic; this run makes it correct
    # regardless of trigger timing (the trigger firings converge to the same
    # state and become redundant no-ops).
    from quantumsafe.fb import enforcement, scoring

    assessment, previous = scoring.rescore_user(db, target_uid)
    enforcement.apply_policy(db, target_uid, assessment, previous)

    return len(events)
