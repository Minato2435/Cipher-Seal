"""Firestore + Auth clients bound to the non-default `default2` database."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import firebase_admin
from firebase_admin import auth as _auth
from firebase_admin import credentials, firestore

from quantumsafe.fb.config import DATABASE

_KEY_FILE = Path(__file__).resolve().parents[2] / "serviceAccountKey.json"


def _ensure_app() -> None:
    if firebase_admin._apps:  # already initialised
        return
    if _KEY_FILE.is_file() and "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ:
        firebase_admin.initialize_app(credentials.Certificate(str(_KEY_FILE)))
    else:
        firebase_admin.initialize_app()


@lru_cache(maxsize=1)
def get_db():
    _ensure_app()
    return firestore.client(database_id=DATABASE)


def get_auth():
    _ensure_app()
    return _auth
