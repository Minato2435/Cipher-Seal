import pytest

from quantumsafe.security.policy import STATUS_FOR, decide


def test_status_mapping():
    assert STATUS_FOR == {
        "NORMAL": "normal",
        "ELEVATED": "elevated",
        "HIGH": "high",
        "CRITICAL": "blocked",
    }


def test_same_band_is_noop_but_keeps_status():
    a = decide("HIGH", "HIGH")
    assert a.action == "NONE"
    assert a.status == "high"
    assert a.terminate_sessions is False


def test_escalate_to_elevated_requires_reauth():
    a = decide("NORMAL", "ELEVATED")
    assert a.action == "REQUIRE_REAUTH"
    assert a.require_reauth is True
    assert a.status == "elevated"


def test_escalate_to_high_terminates_sessions():
    a = decide("ELEVATED", "HIGH")
    assert a.action == "TERMINATE_SESSIONS"
    assert a.terminate_sessions is True
    assert a.raise_alert is False


def test_escalate_to_critical_blocks_and_alerts():
    a = decide("HIGH", "CRITICAL")
    assert a.action == "BLOCK"
    assert a.status == "blocked"
    assert a.terminate_sessions is True
    assert a.raise_alert is True


def test_downgrade_to_normal_is_restore():
    a = decide("ELEVATED", "NORMAL")
    assert a.action == "RESTORE"
    assert a.status == "normal"
    assert a.terminate_sessions is False


@pytest.mark.parametrize("prev", ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"])
@pytest.mark.parametrize("new", ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"])
def test_decide_is_total_and_status_follows_new_band(prev, new):
    a = decide(prev, new)
    assert a.status == STATUS_FOR[new]
    assert a.from_band == prev and a.to_band == new
