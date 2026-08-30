# Part 2 — Firebase Backend Deploy Runbook

Deploys the `functions/` Cloud Functions (7 callables + the `on_security_event_created`
Firestore trigger) and the Firestore composite indexes to project `legaldoc-14f4d`,
region `asia-south1`, database `default2`.

Run every step from the repo root. You need the Firebase CLI authenticated
(`firebase login`) against an account with deploy rights on `legaldoc-14f4d`
(currently `classdocs2435@gmail.com`).

## ⚠️ Safety — read before running anything

- **`legaldoc-14f4d` is a reused project.** Its `(default)` Firestore database
  belongs to another app. This project lives entirely in the **`default2`**
  database; `firebase.json` binds every command to it.
- **Never run a bare `firebase deploy`.** It would push `firestore.rules`
  (a deny-all placeholder until Part 3) and could disrupt the other app. Only
  ever use the scoped `--only` forms below.
- **If any command offers to _delete_ indexes**, answer **No** — those belong to
  the other app on `(default)`. Our `firestore.indexes.json` only describes
  `default2`.
- **Blaze plan required** (spec §3.1). Second Firestore database + Python
  functions won't work on Spark. Expected cost for demo usage ≈ $0.

## 1. Install the function dependencies

```bash
pip install -r functions/requirements.txt
```

`scikit-learn`, `numpy`, `joblib` are pinned to exact versions — `model.joblib`
was pickled with them and cross-version unpickling fails silently. Do not relax
the pins.

## 2. Set the application secret

```bash
firebase functions:secrets:set APP_SECRET
```

Paste a long random string, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

This value is the **KEK root**: it derives the wrapping key for every private
key at rest. **If it is ever lost or changed, every stored private key becomes
undecryptable.** Store the exact value in a password manager. Reuse the same
value for any future re-derivation.

## 3. Deploy the Firestore indexes  (do this BEFORE the functions)

```bash
firebase deploy --only firestore:indexes
```

Answer **No** to any delete prompt. The trigger needs the `securityEvents(uid, ts)`
index; without it, `rescore_user` falls back to an unbounded full-collection scan
on every invocation (and in production the code now raises instead — see the fix
for review finding I8).

## 4. Deploy the functions

```bash
firebase deploy --only functions
```

The first deploy enables the required Google APIs and can take several minutes.
It prompts to enable Artifact Registry, Cloud Build, and Cloud Run — accept all.
All eight functions deploy to `asia-south1`; the trigger binds to `default2` and
runs with `max_instances=1` (serialised, so a burst of events produces a
deterministic final risk state).

**Optional (recommended for a live demo):** set `min_instances=1` on
`on_security_event_created` and `send_message` to avoid a ~5–10 s cold start on
the first call (costs a few cents/day; spec §8).

## 5. Verify the deployed trigger

```bash
python scripts/smoke_live.py
```

Expected: prints the stored `riskScores` doc, `TRIGGER OK`, exits 0. The script
writes one real `securityEvents` doc for a throwaway uid directly to `default2`
(no test prefix), polls `riskScores/<uid>` for up to 120 s, asserts it appears
**and** that `modelScore` is a real float in `[0, 1]` (a `WARNING` line means the
model failed to load and the risk engine is running rule-only), then deletes the
`securityEvents`, `riskScores`, and `users` docs it created.

If it times out or warns, check `firebase functions:log` for
`on_security_event_created` errors.

## 6. Grant yourself admin

```bash
python scripts/grant_admin.py --email <your login email>
```

Sets the Auth custom claim `role=admin` (preserving any existing `status`) and
`users/<uid>.role = "admin"`. **Required before the demo** — a `blocked` user can
only be restored by `admin_set_status`, so at least one admin must exist.

## Known limitations carried into Part 3

- HIGH is enforced server-side by re-auth gating on `send_message` /
  `establish_session`, not by killing the ID token (Firebase callables don't
  check token revocation). The client is expected to observe the `status` claim
  and log out.
- `read_message` has no status gate, so a blocked user can still read their own
  history (deliberate — terminated threads stay readable).
- `establish_session` gates only the caller, not the peer.
