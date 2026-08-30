# Smart Quantum-Safe Communication System — Design Spec

- **Date:** 2026-08-29
- **Status:** Approved for planning
- **Author:** xeno1.solutions
- **Source concept:** "Smart quantum safe communication using AI and post quantum cryptography" (project brief PDF in repo root)

---

## 1. Purpose & Context

Final-year undergraduate prototype. It demonstrates the concept from the brief: a
web chat application that layers **Post-Quantum Cryptography (PQC)** over its
transport and uses an **AI anomaly detector** to drive **adaptive security
responses**. The whole system is built on and deployed to **Firebase**.

### Goals

- Real ML-KEM-768 key establishment, AES-256-GCM message encryption, and
  ML-DSA-65 signatures — all functioning and visible in the UI.
- Isolation Forest risk scoring computed from behavioural security events.
- Adaptive policy state machine: **allow → re-authenticate → terminate session →
  block + alert**.
- Polished admin dashboard plus an Attack Simulator for live demonstrations.
- One-command deploy to Firebase Hosting + Functions + Firestore.

### Non-goals (explicit YAGNI)

- Client-side / true end-to-end PQC (documented as future work).
- Production-grade constant-time cryptography.
- Group chat, media messages, message editing, read receipts, typing indicators.
- Multi-region deployment, horizontal scaling, load testing.
- Native mobile apps (responsive web only).

---

## 2. Success Criteria

1. Two users register (keypairs auto-generated on first login), establish a
   session, and exchange messages that are stored in Firestore **only as
   ciphertext + signature + metadata** (never plaintext).
2. A **Crypto Inspector** panel shows, for a selected message: plaintext, ML-KEM
   session-key fingerprint, ciphertext, IV, GCM tag, ML-DSA signature, and the
   verification result.
3. Tampering with a stored message causes verification to fail: the message is
   rejected, a `TAMPER` event is logged, and the sender/recipient risk increases.
4. The Attack Simulator (brute-force login, message flood, off-hours burst)
   pushes a user's risk score across each band threshold, and the dashboard
   reflects the new band + action taken within a few seconds.
5. At `CRITICAL`, the user is blocked and cannot send messages; an admin can
   unblock them from the dashboard.
6. `firebase deploy` produces a working hosted URL. The Firebase Emulator Suite
   runs the identical code locally.
7. The backend `pytest` suite passes: crypto round-trips, tamper rejection, risk
   thresholds, and every policy state transition.

---

## 3. Architecture

### 3.1 Platform components

| Concern | Choice |
|---|---|
| Frontend hosting | Firebase Hosting — React + Vite single-page app |
| Authentication | Firebase Authentication (email/password) + custom claims `role` (`user`\|`admin`) and `status` (`normal`\|`elevated`\|`high`\|`blocked`) |
| Persistence + realtime | Cloud Firestore with `onSnapshot` listeners for chat and dashboard |
| Backend (crypto + AI + policy) | Cloud Functions for Firebase, **Python 3.12, gen 2** |
| Push notifications | Firebase Cloud Messaging — new-message push (**stretch**, not required for success criteria) |
| Local dev / test | Firebase Emulator Suite (Auth + Firestore + Functions) |

**Prerequisite:** the Firebase project must be on the **Blaze** plan (billing
account attached). Expected cost for prototype/demo usage is ~$0 within the free
quota.

### 3.2 Firestore data model

> **As-built (Part 2, database `default2`).** The field names below are the
> contract Parts 3–4 code against — they reflect what the backend actually
> writes, which differs from the original sketch in the b64-suffixed key names
> (inherited from the Part 1 `keystore`/`aead` wrappers). Every collection name
> is also prefixed with `QS_COLLECTION_PREFIX` in tests (empty in production).

| Collection / doc | Fields (as built) |
|---|---|
| `users/{uid}` | `displayName`, `email`, `role` (`user`\|`admin`), `status` (`normal`\|`elevated`\|`high`\|`blocked`), `createdAt`, `reauthAt` (set by `reauth`) — *`lastSeenAt` not yet written* |
| `publicKeys/{uid}` | `mlkemPub_b64`, `mldsaPub_b64`, `mlkemAlg` (`"ML-KEM-768"`), `mldsaAlg` (`"ML-DSA-65"`) |
| `privateKeys/{uid}` | `mlkemPriv_enc`, `mldsaPriv_enc` — each a wrapped-key dict `{alg, salt_b64, iv_b64, ct_b64, tag_b64}`, AES-256-GCM sealed under an `APP_SECRET`-derived KEK with AAD `alg\|uid`; **functions-only access** |
| `sessions/{sessionId}` | `participants` `[uidA, uidB]`, `sessionKey_enc` (wrapped-key dict, keystore uid = `sessionId`), `kemCtB64`, `state` (`active`\|`terminated`), `createdAt` |
| `messages/{messageId}` | `sessionId`, `senderUid`, `recipientUid`, `ct_b64`, `iv_b64`, `tag_b64`, `sig_b64`, `sigAlg` (`"ML-DSA-65"`), `createdAt`, `verified` (`bool`\|`null`) — **ciphertext only, no plaintext field** |
| `securityEvents/{eventId}` | `uid`, `type`, `meta` `{}`, `ts` (server timestamp) |
| `riskScores/{uid}` | `score` (0..1), `band`, `modelScore`, `ruleBoost`, `components` `{}`, `updatedAt` |
| `policyActions/{actionId}` | `uid`, `fromBand`, `toBand`, `action`, `ts`, `actor` (`system`\|`admin`) |
| `alerts/{alertId}` | `uid`, `reason`, `ts`, `acknowledged` (bool) |

`securityEvents.type` enum: `LOGIN_OK`, `LOGIN_FAIL`, `MSG_SENT`, `MSG_RECV`,
`TAMPER`, `SESSION_ESTABLISH`, `RE_AUTH_OK`, `RE_AUTH_FAIL`, `SIM_ATTACK`.
*As built, `MSG_RECV` is defined but no longer written* (reading a message must
not trigger a rescore); `reauth` failure records **both** `RE_AUTH_FAIL` and
`LOGIN_FAIL` so real failed logins feed the risk model.

**Composite indexes** (`firestore.indexes.json`, must be deployed):
`securityEvents(uid, ts)`, `messages(sessionId, createdAt)`,
`sessions(participants CONTAINS, state)`.

### 3.3 Cloud Functions (Python)

**Callable (HTTPS callable, auth-gated):**

| Function | Behaviour |
|---|---|
| `register_keys()` | Called on first login. Generate ML-KEM-768 + ML-DSA-65 keypairs; store public keys; encrypt private keys with the KEK; write the `users` doc. |
| `establish_session(peerUid)` | Load peer ML-KEM public key; `ML_KEM.encaps()` → `(kem_ct, shared_secret)`; HKDF → AES-256 session key; store `sessionKey_enc`; write `sessions` doc + `SESSION_ESTABLISH` event; return `sessionId`. |
| `send_message(sessionId, plaintext)` | Assert caller is a participant, `status != blocked`, session `active`, and policy allows (see 3.5). Decrypt session key; AES-256-GCM encrypt; ML-DSA sign over `sessionId ‖ senderUid ‖ recipientUid ‖ iv ‖ ciphertext ‖ tag` (the binding context); write `messages` doc; write `MSG_SENT` event. |
| `read_message(messageId)` | Caller must be a participant. ML-DSA verify → on failure set `verified=false`, write `TAMPER` event, raise; on success set `verified=true`, AES-GCM decrypt → return plaintext. *As built: no `MSG_RECV` event (would trigger a needless rescore); works on `terminated` sessions.* |
| `reauth(password)` | Verify via Firebase Auth REST. On success write `RE_AUTH_OK` and drop band `ELEVATED → NORMAL`; else `RE_AUTH_FAIL`. |
| `simulate_attack(kind, targetUid?)` | Generate a burst of synthetic `securityEvents` for the demo (`kind` ∈ `brute_force`, `msg_flood`, `off_hours_burst`). |
| `admin_set_status(uid, status)` | Admin only. Unblock / block a user; write a `policyActions` doc. |

**Firestore-triggered:**

| Trigger | Behaviour |
|---|---|
| `on_security_event_created(event)` | Rebuild features for `event.uid` over the rolling window → `model.score()` → blended risk → write `riskScores/{uid}`. If the band changed, run the policy engine → write `policyActions`, set the Auth custom claim, terminate sessions / create an alert as required. |

**Bundled / init:**

- `model.joblib` — Isolation Forest + `StandardScaler`, bundled in the functions
  directory, loaded at cold start.
- `APP_SECRET` — via Cloud Functions config / Secret Manager; KEK derived via
  HKDF.

### 3.4 AI / risk engine

**Features** per `uid` over a rolling window (last `N` events / last `T` minutes):
`login_fail_count`, `login_fail_rate`, `msg_sent_count`, `msg_rate_per_min`,
`mean_msg_interval_s`, `msg_size_mean`, `distinct_recipients`, `session_count`,
`hour_of_day_sin`, `hour_of_day_cos`, `sim_attack_flag`.

**Model:** `sklearn.ensemble.IsolationForest(n_estimators=200,
contamination=0.05)` with a persisted `StandardScaler`. Trained by
`scripts/seed_baseline.py` on synthetic "normal" traffic plus a slice of "attack"
traffic.

**Score blending:**

```
modelScore = normalize(-decision_function(x))            # -> 0..1
ruleBoost  = capped weighted sum of hard signals:
               >= 5 login fails in 5 min      -> +0.40
               msg_rate_per_min > threshold   -> +0.30
               off-hours burst                -> +0.20
               SIM_ATTACK present in window   -> +0.30
score      = clamp(0.6 * modelScore + 0.4 * ruleBoost, 0, 1)
```

**Bands** (thresholds live in `thresholds.json`, tuned during seeding). Original
sketch: `NORMAL < 0.35`, `ELEVATED 0.35–0.60`, `HIGH 0.60–0.80`, `CRITICAL >= 0.80`.
**As-built (seed-tuned):** `elevated 0.444`, `high 0.601`, `critical 0.78` — the
CRITICAL/auto-block bar was raised so ~0% of synthetic normal traffic auto-blocks
while every simulated attack still reaches at least HIGH. A guard test
(`test_fb_thresholds_guard.py`) pins `critical >= 0.75` and re-checks calibration.
`msg_rate_per_min` boost uses a fixed threshold of 30.

### 3.5 Policy engine (`security/policy.py` + `fb/enforcement.py`)

Band → action. **Idempotent** — acts only when the band changes.

| Band | Action (as built) |
|---|---|
| `NORMAL` | Ensure `status=normal`; sessions remain active. |
| `ELEVATED` | `status=elevated`; `send_message` **and** `establish_session` require a fresh `reauth` (≤ 600 s). |
| `HIGH` | `status=high`; sessions `state=terminated` + `revoke_refresh_tokens`; `send_message`/`establish_session` gated exactly like `ELEVATED` (server-side — the client-logout is advisory only, since a callable ID token isn't checked for revocation). |
| `CRITICAL` | `status=blocked`; terminate sessions; create an `alert`. **Sticky:** `apply_policy` refuses to auto-downgrade a `blocked` user — only `admin_set_status` restores. An admin (`grant_admin.py`) must exist before anyone can be unblocked. |

Terminated sessions stay **readable** (`read_message` passes `require_active=False`)
so history survives an escalation; only sending is blocked.

**Downgrades:** `reauth` success moves `ELEVATED → NORMAL`; admin action moves
`blocked → normal`. `HIGH` clears on the forced re-login (which resets the
window). Time-based auto-decay of `HIGH` is a stretch item.

### 3.6 Frontend (React + Vite + TypeScript + Tailwind)

**Pages:** `Login`, `Register`, `Chat`, `Dashboard` (admin), `AttackSim`.

- **Chat:** conversation list; realtime message thread (`onSnapshot`); composer;
  `CryptoInspector` drawer (calls `read_message`, shows all crypto artifacts);
  status banner that triggers the re-auth modal when the band is `ELEVATED`/`HIGH`.
- **Dashboard:** user table with live risk band; `RiskTimeline` chart (Recharts)
  for the selected user; realtime `EventFeed`; `AlertsPanel` with acknowledge;
  unblock button.
- **AttackSim:** pick a target + attack kind → calls `simulate_attack` → watch
  the dashboard react.

**Libraries:** Firebase JS SDK (`auth`, `firestore`, `functions`), Recharts,
`lucide-react`, Tailwind CSS.

### 3.7 Firestore security rules

- `users`: read own doc; admins read all. Clients **cannot** write `role` or
  `status`.
- `publicKeys`: any authenticated user may read; no client writes.
- `privateKeys`: no client read or write (functions only).
- `sessions`: read if `request.auth.uid in resource.data.participants`; no client
  writes.
- `messages`: read if `request.auth.uid in [senderUid, recipientUid]`; no client
  writes (send only via `send_message`).
- `securityEvents` / `riskScores` / `policyActions` / `alerts`: admin read only;
  no client writes.

All privileged writes go through Cloud Functions using the Admin SDK, which
bypasses rules.

---

## 4. Error Handling

| Situation | Response |
|---|---|
| `send_message` while band == `ELEVATED` without fresh re-auth | `failed-precondition` `"REAUTH_REQUIRED"` → client opens re-auth modal |
| `send_message` while `status == blocked` | `permission-denied` `"ACCOUNT_BLOCKED"` |
| `read_message` signature verification fails | set `verified=false`, write `TAMPER` event, raise `"SIGNATURE_INVALID"` |
| AES-GCM decrypt fails (`InvalidTag`) | generic `"DECRYPT_FAILED"`, logged, **no plaintext leak** |
| `establish_session` with missing peer keys | `failed-precondition` `"PEER_NOT_READY"` |
| Cold start / model load failure | retry once; else log and return a degraded score using `ruleBoost` only |
| Client listener disconnect | Firebase SDK auto-reconnects; UI shows "reconnecting" |

---

## 5. Testing

**Backend (`pytest`, run against the emulator + plain modules):**

- `crypto/kem`: `encaps → decaps` shared-secret equality; wrong key → mismatch.
- `crypto/aead`: `encrypt → decrypt` round-trip; tampered ciphertext/tag →
  `InvalidTag`.
- `crypto/sign`: `sign → verify` OK; flipped byte → `verify` returns false.
- `ai/risk`: known feature vectors map to expected bands; rule boosts fire at
  their thresholds.
- `security/policy`: every transition `NORMAL ↔ ELEVATED ↔ HIGH ↔ CRITICAL` and
  the downgrades; idempotency (same band twice → no duplicate action).
- Functions integration: `send_message` writes ciphertext only (assert no
  plaintext field present); `read_message` by a non-participant → denied.

**Frontend (Vitest + Testing Library, light):**

- `CryptoInspector` renders artifacts from a mocked `read_message`.
- The re-auth modal appears on a `REAUTH_REQUIRED` error.

**Manual:** `docs/demo.md` — a scripted walkthrough covering success criteria 1–6.

---

## 6. Project Structure

```
firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
functions/
  main.py                 # callable + triggered entrypoints
  quantumsafe/
    crypto/  kem.py  sign.py  aead.py  keystore.py
    ai/      features.py  model.py  risk.py
    security/ policy.py  events.py
    config.py
  model.joblib
  requirements.txt         # firebase-functions, firebase-admin, kyber-py,
                           # dilithium-py, cryptography, scikit-learn, numpy, joblib
  tests/
scripts/
  seed_baseline.py         # synthetic traffic -> train -> model.joblib + thresholds.json
web/
  index.html  vite.config.ts  tailwind.config.js
  src/
    lib/       firebase.ts  api.ts
    pages/     Login.tsx  Register.tsx  Chat.tsx  Dashboard.tsx  AttackSim.tsx
    components/ MessageThread.tsx  CryptoInspector.tsx  RiskTimeline.tsx
               EventFeed.tsx  UserTable.tsx  AlertsPanel.tsx  ReAuthModal.tsx
    tests/
docs/
  architecture.md  crypto-notes.md  ai-notes.md  demo.md
  superpowers/specs/2026-08-29-smart-quantum-safe-comm-design.md
README.md
run-emulators.ps1
```

---

## 7. Build Phases

1. Repo + Firebase project + emulator config + `pytest` scaffold.
2. `crypto/` modules + tests (`kem`, `aead`, `sign`, `keystore`).
3. `ai/` + `scripts/seed_baseline.py` → `model.joblib` + `thresholds.json`.
4. `security/policy` + `events` + tests.
5. Cloud Functions wiring (callables + trigger) against the emulator.
6. Firestore rules + indexes.
7. `web/` auth + chat + `CryptoInspector`.
8. `web/` dashboard + Attack Simulator.
9. Visual design pass, `docs/demo.md`, deploy to Firebase.
10. End-to-end rehearsal against the deployed project.

---

## 8. Caveats / Future Work

- **Educational PQC libraries.** `kyber-py` and `dilithium-py` are correct
  FIPS 203 / FIPS 204 implementations but are **not constant-time** — cite this in
  the report.
- **Server-mediated crypto.** Plaintext transits the callable function. Future
  work: client-side WebAssembly ML-KEM / ML-DSA so that Firestore *and* the
  functions never see plaintext.
- **Cold starts.** Set `minInstances: 1` on `on_security_event_created` and
  `send_message` for the demo to avoid ~5–10 s first-call latency.
- **Blaze plan required.** Expected cost ~$0 within the free quota.
- **Synthetic training data.** The Isolation Forest is trained on generated
  traffic; a real deployment would retrain on collected behaviour.
