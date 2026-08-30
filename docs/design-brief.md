# Design brief — Smart Quantum-Safe Communication System

Design a web interface for a secure messaging app whose real subject is **lattice
cryptography and a watchful AI**. Two people send each other messages; every
message is sealed with post-quantum cryptography before it leaves the sender's
session, and an AI continuously scores each user's behaviour and can escalate a
security response in real time. The interface's one job: let people talk while
making the *sealing* and the *watching* visible and legible.

Audience: a final-year computer-science project demo and its evaluators —
technically literate, unimpressed by generic dashboards.

## The feeling

A mathematician's notebook with a single lit instrument set into it. Calm,
precise, paper-like — until the AI raises the alarm, at which point the interface
visibly changes temperature. The security state is not a badge in a corner; it is
the room you are in.

**Avoid** the three current AI-design clichés: warm cream + high-contrast serif +
terracotta; near-black background + one acid-green accent; broadsheet hairlines +
zero border-radius + dense newspaper columns. This should not look like a
templated dark SaaS dashboard.

## Palette (starting point — refine as you like)

- `paper` `#EDF0F3` — cool blue-grey ground, like graph paper
- `ink` `#14181F` — blue-black text
- `ink-soft` `#5B6470` — labels, the faint lattice grid
- `instrument` `#0B1220` — the one dark surface (an "oscilloscope" panel inset into the paper)
- `phosphor` `#86E5D0` — signal that appears **only inside** the dark instrument panel
- Risk ramp, used for the adaptive chrome only: `calm #3A4453` → `elevated #C98A2B` → `high #C1541F` → `critical #A01E22`

No green anywhere except the phosphor, and only inside the instrument.

## Typography (starting point)

- **Display:** Instrument Serif — high-contrast, engraved-plate character (also the
  contrast of LaTeX math typesetting). Used sparingly: screen titles, the risk-band plate.
- **UI text:** IBM Plex Sans — labels, buttons, body.
- **Data:** IBM Plex Mono — every cryptographic artifact (keys, ciphertext hex,
  signatures, fingerprints, IDs, risk numbers), grouped and truncated with a
  middle ellipsis.

## Signature elements (the two things the design is remembered by)

1. **The adaptive risk frame.** A hairline frame around the whole app whose colour
   and thickness track the signed-in user's AI risk band — a barely-there grey at
   `normal`, a thick deep red at `critical`, with a slow ~1.1s temperature
   transition between states. The band word is engraved on a small opaque corner
   plate, colour-matched.

2. **The transformation strip.** A dark lit panel docked under the message
   composer. When you send, it plays your plaintext through the pipeline, left to
   right, staged over ~700ms:
   - `plain` — your typed text in quotes
   - `ML-KEM` — glyphs shuffle, then settle into a 16-hex session-key fingerprint
   - `AES-GCM` — the ciphertext streams in as grouped hex, clipped to one line
   - `ML-DSA` — a bar wipes across, then a `✓` stamps with a small scale-pop and
     an "N-byte seal" label
   Under reduced-motion it resolves instantly to the final state.

## Screens

### 1. Sign in / Register
Centered composition on the lattice ground. Instrument Serif title, IBM Plex Sans
labels, mono input fields. A small angular mark of the two lattice basis vectors
above the title. Register asks for display name, email, password; on success it
provisions the user's post-quantum keypairs and drops them into the chat console.
Errors are plain and specific ("That email is already registered.", "Password
needs at least 6 characters."), never apologetic.

### 2. Chat console (the main screen)
Two columns inside the adaptive risk frame.

**Left rail (~300px):**
- Identity: display name (serif), email (mono), and an `id` chip that
  middle-truncates the user's ID and copies it on click.
- A `sessions` section with a compact "+ new" that opens a small form: "Peer's
  user ID" + helper text "They copy it from the id chip at the top of their
  sidebar." Starting a session runs a real ML-KEM key exchange.
- The session list: each row shows the other person's name, a phosphor dot if the
  session is active / a hollow ring if it has ended, and a serif `▸` marker on the
  selected row.
- **The lit risk instrument** (dark `instrument` panel): a thin score track
  (0–1, filled in the current band's colour with a soft glow), the band word in
  serif, a `model 0.14 · rules 0.00` split line, and — when present — a list of
  the rule components that fired (`brute force +0.40`).
- Footer: a "security monitor" link (admins only) and "sign out".

**Main column:**
- Empty state: a clean drawing of the ML-KEM lattice — a point grid, the two basis
  vectors in ink, and the short "hard" vector in `high` orange — with the caption
  "Every session opens with an ML-KEM exchange — a lattice problem with no quantum
  shortcut. Paste a peer's user ID in the sidebar to begin."
- Active session: a header with the other person's name (serif) and "session
  ended" (mono) if terminated; a scrolling thread of message bubbles — mine
  right-aligned on a faint instrument-tinted ground, theirs left on paper, each
  with a mono footer showing the time and `✓ verified` once the signature checks;
  a tampered message renders in `high` with "signature check failed — message
  rejected" and no body.
- Composer: a mono textarea + a "send" button, with the **transformation strip**
  docked beneath it.
- When the risk engine demands it, a small modal: "Confirm it's you — your recent
  activity looked unusual. Re-enter your password to keep sending." When the
  account is locked, the composer is disabled with "This account is locked. An
  administrator can restore it." in `critical`.

### 3. Security monitor (admin only)
Same lattice ground. Title "Security monitor" in serif. A responsive layout:
- **User table** — each row: display name, email, truncated ID, a role tag, a
  status chip colour-matched to the risk ramp, current band + score. A blocked row
  gets an "unblock" button. Any row gets a "simulate ▾" that targets the attack
  simulator at that user.
- **Risk timeline** — a line chart on a dark `instrument` card: a phosphor line of
  a selected user's risk score over time, with three faint horizontal threshold
  rules at the elevated / high / critical marks, mono axis ticks.
- **Alerts panel** — unacknowledged alerts, each in a `critical`-outlined card:
  the reason, the user, the time, an "acknowledge" button.
- **Event feed** — a live mono list of security events: time · type · user · a
  compact detail. `TAMPER`, `LOGIN_FAIL`, and `SIM_ATTACK` types in `high`.

### 4. Attack simulator (a panel, reachable from the monitor)
Compact: a target user ID, a segmented control (`brute force · message flood ·
off-hours burst`), and a "run simulation" button. After it runs: "wrote N events —
watch the monitor." This is what drives the demo: run a simulation, watch the
target user's risk band climb and their adaptive frame turn amber then red.

## Quality floor

Responsive down to ~380px (the rail collapses to a top bar with a session
dropdown). Visible keyboard focus everywhere. `prefers-reduced-motion` respected —
the transformation strip and the frame recolour resolve instantly. Interface copy
is sentence case, active voice, specific, never apologetic; an empty screen is an
instruction, an error says what happened and what to do.

## One aesthetic risk to take

Let the whole chrome change palette with the security band, and keep everything
else quiet and disciplined around it. That single move — the interface enacting
the adaptive security response rather than annotating it — is the point.
