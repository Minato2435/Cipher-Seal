"""Domain errors and their mapping to callable-function error codes."""

from __future__ import annotations

from firebase_functions import https_fn

REAUTH_REQUIRED = "REAUTH_REQUIRED"
ACCOUNT_BLOCKED = "ACCOUNT_BLOCKED"
SIGNATURE_INVALID = "SIGNATURE_INVALID"
DECRYPT_FAILED = "DECRYPT_FAILED"
PEER_NOT_READY = "PEER_NOT_READY"
NOT_PARTICIPANT = "NOT_PARTICIPANT"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"
SESSION_INACTIVE = "SESSION_INACTIVE"


class AppError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


_FEC = https_fn.FunctionsErrorCode
_MAP = {
    REAUTH_REQUIRED: _FEC.FAILED_PRECONDITION,
    ACCOUNT_BLOCKED: _FEC.PERMISSION_DENIED,
    SIGNATURE_INVALID: _FEC.FAILED_PRECONDITION,
    DECRYPT_FAILED: _FEC.INTERNAL,
    PEER_NOT_READY: _FEC.FAILED_PRECONDITION,
    NOT_PARTICIPANT: _FEC.PERMISSION_DENIED,
    FORBIDDEN: _FEC.PERMISSION_DENIED,
    NOT_FOUND: _FEC.NOT_FOUND,
    SESSION_INACTIVE: _FEC.FAILED_PRECONDITION,
}


def to_https_error(err: AppError) -> https_fn.HttpsError:
    code = _MAP.get(err.code, _FEC.INTERNAL)
    return https_fn.HttpsError(code=code, message=f"{err.code}: {err.message}")
