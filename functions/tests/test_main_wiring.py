import importlib


def test_all_endpoints_exist_and_are_callables():
    main = importlib.import_module("main")
    for name in [
        "register_keys", "establish_session", "send_message", "read_message",
        "reauth", "simulate_attack", "admin_set_status", "on_security_event_created",
    ]:
        assert callable(getattr(main, name)), name


def test_endpoints_are_configured_for_asia_south1_and_default2():
    main = importlib.import_module("main")
    # firebase-functions 0.6.0 attaches a `__firebase_endpoint__` ManifestEndpoint
    # (verified: `.region` is a list, trigger `.eventTrigger` is a dict).
    reg = main.register_keys.__firebase_endpoint__
    assert reg.region == ["asia-south1"]

    trig = main.on_security_event_created.__firebase_endpoint__
    assert trig.region == ["asia-south1"]
    assert trig.eventTrigger["eventFilters"]["database"] == "default2"


def test_reauth_helper_maps_bad_password(monkeypatch):
    main = importlib.import_module("main")
    monkeypatch.setattr(main, "_verify_password", lambda email, pw: False)
    assert main._verify_password("x@y.com", "bad") is False
