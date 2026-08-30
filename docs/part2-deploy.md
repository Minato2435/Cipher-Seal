# Part 2 — Firebase Backend Deploy Runbook

Deploys the `functions/` Cloud Functions (7 callables + the `on_security_event_created`
Firestore trigger) and the Firestore indexes to project `legaldoc-14f4d`, region
`asia-south1`, database `default2`.

Run every step from the repo root. You need the Firebase CLI authenticated
(`firebase login`) against an account with deploy rights on `legaldoc-14f4d`.

## 1. Install the function dependencies

```bash
pip install -r functions/requirements.txt
```

## 2. Set the application secret

```bash
firebase functions:secrets:set APP_SECRET
```

Paste a long random string (e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`).

This value is the KEK root: it is used to derive the wrapping key for every
private key at rest. **If it is ever lost or changed, every stored private key
becomes undecryptable.** Store the exact value in a password manager. The same
value must be reused for any future re-derivation of the database.

## 3. Deploy the Firestore indexes

```bash
firebase deploy --only firestore:indexes
```

## 4. Deploy the functions

```bash
firebase deploy --only functions
```

The first deploy enables the required Google APIs and can take several minutes.
It also prompts to enable Artifact Registry, Cloud Build, and Cloud Run — accept
all of them. All eight functions deploy to `asia-south1`; the trigger binds to
the `default2` database.

## 5. Verify the deployed trigger

```bash
python scripts/smoke_live.py
```

Expected: prints `TRIGGER OK` and exits 0. The script writes one real
`securityEvents` doc for a throwaway uid directly to `default2` (no test
prefix), polls `riskScores/<uid>` for up to 120 s, asserts it appears (proving
the deployed `on_security_event_created` ran), then deletes both docs. It exits
non-zero on timeout.

If it times out, check `firebase functions:log` for `on_security_event_created`
errors.

## 6. Grant yourself admin

```bash
python scripts/grant_admin.py --email <your login email>
```

Sets the Auth custom claim `role=admin` (preserving any existing `status`) and
`users/<uid>.role = "admin"`. Required for the `admin_set_status` callable and
for targeting another user with `simulate_attack`.
