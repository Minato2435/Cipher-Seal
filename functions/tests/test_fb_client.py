import pytest

from quantumsafe.fb import config
from quantumsafe.fb.client import get_db


def test_collection_prefixing_is_active_in_tests():
    name = config.collection("users")
    assert name.startswith("test_") and name.endswith("_users")


def test_app_secret_returns_bytes():
    assert isinstance(config.app_secret(), bytes)
    assert len(config.app_secret()) > 0


def test_region_and_database_constants():
    assert config.REGION == "asia-south1"
    assert config.DATABASE == "default2"


def test_get_db_round_trips_a_document_on_default2(db):
    ref = db.collection(config.collection("users")).document("probe")
    ref.set({"hello": "default2"})
    got = ref.get()
    assert got.exists and got.to_dict()["hello"] == "default2"
    ref.delete()


def test_bundled_model_artifacts_exist():
    import os
    assert os.path.isfile(config.model_path())
    assert os.path.isfile(config.thresholds_path())
