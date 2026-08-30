# Part 3 — Firestore security rules notes

`firestore.rules` governs only the **client SDK** (the web app). The Cloud
Functions use the Admin SDK, which bypasses rules entirely — so the Python test
suite and every function is unaffected by these rules.

## What the client can do

| Collection | Client read | Client write |
|---|---|---|
| `users/{uid}` | own doc; admins read + list all | never |
| `publicKeys/{uid}` | any signed-in user (needed to start a session) | never |
| `privateKeys/{uid}` | never | never |
| `sessions/{id}` | if `uid in participants`, or admin | never |
| `messages/{id}` | if `uid in participants`, or admin | never |
| `riskScores/{uid}` | own doc; admins read + list | never |
| `securityEvents`, `policyActions`, `alerts` | admin only | never |

## Query requirements

Firestore rejects a collection query unless every returned document provably
satisfies the read rule. So the client **must** carry these filters:

- `sessions` → `where('participants', 'array-contains', uid)`
- `messages` → `where('participants', 'array-contains', uid)` (the `participants`
  array was added to message docs in Phase A Task 1 for exactly this)
- `riskScores` → fetch by document id `doc(db, 'riskScores', uid)`; only an admin
  may `list` the collection
- admin views of `securityEvents` / `users` / `alerts` are plain collection
  queries, allowed because `isAdmin()` short-circuits the rule

## Custom claims and token refresh

`role` and `status` live in the Firebase Auth **custom claims**, set by
`scripts/grant_admin.py` and the `admin_set_status` / policy-enforcement paths.
A client only sees a claim change after its ID token refreshes. After any action
that changes a user's `role` or `status`, that user's app should call
`user.getIdToken(true)` (the `useAuthUser` hook exposes `refreshClaims()`), or
simply sign out and back in.

## Deploy

```bash
firebase deploy --only firestore:rules --project legaldoc-14f4d
```

Targets `default2` (per `firebase.json`). Replaces the earlier deny-all
placeholder; does not touch the `(default)` database. Answer **No** to any
delete prompt.
