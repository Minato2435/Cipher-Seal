"""Map a risk-band transition to the security action the system must take.

``decide`` is total over the 4x4 band grid and idempotent: an unchanged band
yields ``action="NONE"`` while still reporting the correct account status.
"""

from __future__ import annotations

from dataclasses import dataclass

_ORDER = {"NORMAL": 0, "ELEVATED": 1, "HIGH": 2, "CRITICAL": 3}

STATUS_FOR = {
    "NORMAL": "normal",
    "ELEVATED": "elevated",
    "HIGH": "high",
    "CRITICAL": "blocked",
}


@dataclass(frozen=True)
class PolicyAction:
    from_band: str
    to_band: str
    action: str
    status: str
    terminate_sessions: bool
    raise_alert: bool
    require_reauth: bool


def decide(previous_band: str, new_band: str) -> PolicyAction:
    if previous_band not in _ORDER or new_band not in _ORDER:
        raise ValueError(f"unknown band(s): {previous_band!r} -> {new_band!r}")

    status = STATUS_FOR[new_band]

    if previous_band == new_band:
        return PolicyAction(previous_band, new_band, "NONE", status, False, False, False)

    if _ORDER[new_band] < _ORDER[previous_band] and new_band == "NORMAL":
        return PolicyAction(previous_band, new_band, "RESTORE", status, False, False, False)

    # The two guards above consume every transition into NORMAL, so the action
    # depends only on the new band -- including downgrades: CRITICAL -> HIGH
    # still terminates sessions and CRITICAL -> ELEVATED still forces re-auth,
    # because the account is not yet trusted again.
    if new_band == "ELEVATED":
        return PolicyAction(previous_band, new_band, "REQUIRE_REAUTH", status, False, False, True)
    if new_band == "HIGH":
        return PolicyAction(previous_band, new_band, "TERMINATE_SESSIONS", status, True, False, False)
    return PolicyAction(previous_band, new_band, "BLOCK", status, True, True, False)  # CRITICAL
