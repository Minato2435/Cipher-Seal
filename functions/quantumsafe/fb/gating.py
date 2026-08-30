"""Server-side account-status gate, shared by messaging and session setup.

Kept in its own module so both ``messaging`` and ``sessions`` can use it without
an import cycle (``messaging`` imports ``sessions``).
"""

from __future__ import annotations

import time
from datetime import datetime

from quantumsafe.fb import repo
from quantumsafe.fb.errors import ACCOUNT_BLOCKED, REAUTH_REQUIRED, AppError

REAUTH_WINDOW_S = 600.0


def gate_user(db, uid: str) -> None:
    """Raise if ``uid``'s account status forbids a privileged operation.

    ``high`` is enforced exactly like ``elevated``: Firebase's
    ``revoke_refresh_tokens`` does NOT invalidate an already-issued callable ID
    token, so without a server-side check a HIGH user keeps sending until that
    token expires. Both bands therefore require a fresh re-auth.
    """
    user = repo.get(db, "users", uid) or {}
    status = user.get("status", "normal")
    if status == "blocked":
        raise AppError(ACCOUNT_BLOCKED, "account is blocked")
    if status in ("elevated", "high"):
        ts = user.get("reauthAt")
        epoch = ts.timestamp() if isinstance(ts, datetime) else None
        if epoch is None or (time.time() - epoch) > REAUTH_WINDOW_S:
            raise AppError(REAUTH_REQUIRED, "re-authentication required")
