"""Per-user PQC key provisioning and loading, backed by Firestore."""

from __future__ import annotations

import base64

from quantumsafe.crypto.keystore import generate_user_keys, unwrap_private_key
from quantumsafe.fb import repo
from quantumsafe.fb.errors import PEER_NOT_READY, AppError


def provision_user(
    db,
    uid: str,
    app_secret: bytes,
    *,
    display_name: str | None = None,
    email: str | None = None,
) -> bool:
    if repo.get(db, "publicKeys", uid) is not None:
        return False

    material = generate_user_keys(app_secret, uid)
    # publicKeys is written LAST because it is the idempotency sentinel above:
    # a crash mid-provision then leaves it unwritten, so a re-run repairs the
    # user instead of leaving them permanently half-provisioned.
    repo.set(db, "privateKeys", uid, material["private"])
    repo.merge(
        db,
        "users",
        uid,
        {
            "displayName": display_name or uid,
            "email": email,
            "role": "user",
            "status": "normal",
            "createdAt": repo.SERVER_TIMESTAMP,
        },
    )
    repo.set(db, "publicKeys", uid, material["public"])
    return True


def _pub(db, uid: str) -> dict:
    doc = repo.get(db, "publicKeys", uid)
    if doc is None:
        raise AppError(PEER_NOT_READY, f"user {uid} has no published keys")
    return doc


def load_kem_public(db, uid: str) -> bytes:
    return base64.b64decode(_pub(db, uid)["mlkemPub_b64"])


def load_sign_public(db, uid: str) -> bytes:
    return base64.b64decode(_pub(db, uid)["mldsaPub_b64"])


def _priv(db, uid: str) -> dict:
    doc = repo.get(db, "privateKeys", uid)
    if doc is None:
        raise AppError(PEER_NOT_READY, f"user {uid} has no private keys")
    return doc


def load_sign_secret(db, uid: str, app_secret: bytes) -> bytes:
    return unwrap_private_key(app_secret, _priv(db, uid)["mldsaPriv_enc"], uid)


def load_kem_secret(db, uid: str, app_secret: bytes) -> bytes:
    return unwrap_private_key(app_secret, _priv(db, uid)["mlkemPriv_enc"], uid)
