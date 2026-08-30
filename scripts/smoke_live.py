"""Post-deploy check: prove the deployed on_security_event_created trigger runs.

Writes a real securityEvents doc to default2 (NO test prefix), waits for the
deployed function to write riskScores/<uid>, then cleans up.
"""

from __future__ import annotations

import os
import sys
import time
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

os.environ.pop("QS_COLLECTION_PREFIX", None)  # hit real collections

from quantumsafe.fb.client import get_db  # noqa: E402
from quantumsafe.fb import repo            # noqa: E402


def main() -> int:
    db = get_db()
    uid = f"smoke-{uuid.uuid4().hex[:8]}"
    eid = repo.add(db, "securityEvents", {"uid": uid, "type": "SIM_ATTACK", "meta": {"kind": "brute_force"}, "ts": repo.SERVER_TIMESTAMP})
    print(f"wrote securityEvents/{eid} for {uid}; waiting for trigger...")

    deadline = time.time() + 120
    ok = False
    while time.time() < deadline:
        if repo.get(db, "riskScores", uid) is not None:
            ok = True
            break
        time.sleep(5)

    # cleanup
    from quantumsafe.fb.config import collection
    db.collection(collection("securityEvents")).document(eid).delete()
    if repo.get(db, "riskScores", uid) is not None:
        db.collection(collection("riskScores")).document(uid).delete()

    print("TRIGGER OK" if ok else "TRIGGER TIMEOUT")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
