"""The security-event vocabulary shared by the AI and policy layers."""

from __future__ import annotations

from dataclasses import dataclass, field

LOGIN_OK = "LOGIN_OK"
LOGIN_FAIL = "LOGIN_FAIL"
MSG_SENT = "MSG_SENT"
MSG_RECV = "MSG_RECV"
TAMPER = "TAMPER"
SESSION_ESTABLISH = "SESSION_ESTABLISH"
RE_AUTH_OK = "RE_AUTH_OK"
RE_AUTH_FAIL = "RE_AUTH_FAIL"
SIM_ATTACK = "SIM_ATTACK"

VALID_TYPES = frozenset(
    {
        LOGIN_OK,
        LOGIN_FAIL,
        MSG_SENT,
        MSG_RECV,
        TAMPER,
        SESSION_ESTABLISH,
        RE_AUTH_OK,
        RE_AUTH_FAIL,
        SIM_ATTACK,
    }
)


@dataclass(frozen=True)
class SecurityEvent:
    uid: str
    type: str
    ts: float
    meta: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.type not in VALID_TYPES:
            raise ValueError(f"unknown security event type: {self.type!r}")

    def to_dict(self) -> dict:
        return {"uid": self.uid, "type": self.type, "ts": self.ts, "meta": dict(self.meta)}

    @classmethod
    def from_dict(cls, d: dict) -> "SecurityEvent":
        return cls(uid=d["uid"], type=d["type"], ts=float(d["ts"]), meta=dict(d.get("meta") or {}))
