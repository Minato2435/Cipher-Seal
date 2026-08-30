"""Runtime configuration for the Firebase adapter layer."""

from __future__ import annotations

import os
from pathlib import Path

from quantumsafe.ai.features import DEFAULT_WINDOW_SECONDS  # re-export

REGION = "asia-south1"
DATABASE = "default2"

_FUNCTIONS_DIR = Path(__file__).resolve().parents[2]  # .../functions


def app_secret() -> bytes:
    raw = os.environ.get("APP_SECRET", "")
    if not raw:
        raise RuntimeError("APP_SECRET is not set")
    return raw.encode("utf-8")


def collection(base: str) -> str:
    return os.environ.get("QS_COLLECTION_PREFIX", "") + base


def model_path() -> str:
    return str(_FUNCTIONS_DIR / "model.joblib")


def thresholds_path() -> str:
    return str(_FUNCTIONS_DIR / "thresholds.json")


__all__ = [
    "REGION", "DATABASE", "DEFAULT_WINDOW_SECONDS",
    "app_secret", "collection", "model_path", "thresholds_path",
]
