from firebase_functions import https_fn

from quantumsafe.fb import errors
from quantumsafe.fb.errors import AppError, to_https_error


def test_codes_are_self_named():
    assert errors.REAUTH_REQUIRED == "REAUTH_REQUIRED"
    assert errors.ACCOUNT_BLOCKED == "ACCOUNT_BLOCKED"
    assert errors.NOT_PARTICIPANT == "NOT_PARTICIPANT"


def test_app_error_carries_code_and_message():
    e = AppError(errors.PEER_NOT_READY, "peer has no keys")
    assert e.code == "PEER_NOT_READY"
    assert e.message == "peer has no keys"
    assert "peer has no keys" in str(e)


def test_mapping_to_https_error():
    blocked = to_https_error(AppError(errors.ACCOUNT_BLOCKED, "blocked"))
    assert isinstance(blocked, https_fn.HttpsError)
    assert blocked.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    reauth = to_https_error(AppError(errors.REAUTH_REQUIRED, "reauth"))
    assert reauth.code == https_fn.FunctionsErrorCode.FAILED_PRECONDITION

    forbidden = to_https_error(AppError(errors.FORBIDDEN, "admins only"))
    assert forbidden.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    unknown = to_https_error(AppError("SOMETHING_ELSE", "x"))
    assert unknown.code == https_fn.FunctionsErrorCode.INTERNAL
