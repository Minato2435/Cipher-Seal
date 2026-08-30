import pytest

from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    VALID_TYPES,
    SecurityEvent,
)


def test_valid_types_contains_known_events():
    assert {"LOGIN_OK", "LOGIN_FAIL", "MSG_SENT", "TAMPER", "SIM_ATTACK"} <= VALID_TYPES


def test_construct_valid_event():
    ev = SecurityEvent(uid="u1", type=MSG_SENT, ts=100.0, meta={"size": 12})
    assert ev.type == "MSG_SENT"
    assert ev.meta["size"] == 12


def test_unknown_type_rejected():
    with pytest.raises(ValueError):
        SecurityEvent(uid="u1", type="NOPE", ts=1.0)


def test_meta_defaults_to_empty_dict():
    ev = SecurityEvent(uid="u1", type=LOGIN_FAIL, ts=1.0)
    assert ev.meta == {}


def test_to_dict_from_dict_round_trip():
    ev = SecurityEvent(uid="u1", type=LOGIN_FAIL, ts=5.0, meta={"ip": "x"})
    assert SecurityEvent.from_dict(ev.to_dict()) == ev
