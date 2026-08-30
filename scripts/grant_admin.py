"""Grant a user the admin role (custom claim + users doc). Usage:
    python scripts/grant_admin.py --email you@example.com
    python scripts/grant_admin.py --uid <firebase-uid>
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

from quantumsafe.fb import repo                     # noqa: E402
from quantumsafe.fb.client import get_auth, get_db  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--uid")
    g.add_argument("--email")
    args = ap.parse_args()

    auth = get_auth()
    user = auth.get_user(args.uid) if args.uid else auth.get_user_by_email(args.email)
    claims = dict(user.custom_claims or {})
    claims["role"] = "admin"
    claims.setdefault("status", "normal")
    auth.set_custom_user_claims(user.uid, claims)
    repo.merge(get_db(), "users", user.uid, {"role": "admin"})
    print(f"granted admin to {user.uid} ({user.email})")


if __name__ == "__main__":
    main()
