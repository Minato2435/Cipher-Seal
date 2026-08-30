import pytest

from quantumsafe.fb import simulation
from quantumsafe.fb.errors import AppError
from quantumsafe.security.events import SIM_ATTACK

KINDS = ["brute_force", "msg_flood", "off_hours_burst"]


def _events(db):
    from quantumsafe.fb.config import collection
    return [d.to_dict() for d in db.collection(collection("securityEvents")).stream()]


@pytest.mark.parametrize("kind", KINDS)
def test_run_simulated_attack_is_capped_and_tagged(db, kind):
    uid = f"sim-target-{kind}"
    written = simulation.run_simulated_attack(db, uid, kind)

    rows = _events(db)
    assert written == len(rows)
    assert written <= 40
    assert all(r["uid"] == uid for r in rows)
    assert all(r["meta"].get("simulated") is True for r in rows)
    assert sum(1 for r in rows if r["type"] == SIM_ATTACK) == 1


def test_unknown_kind_raises_invalid_kind(db):
    with pytest.raises(AppError) as ei:
        simulation.run_simulated_attack(db, "sim-target-x", "not_a_kind")
    assert ei.value.code == "INVALID_KIND"
