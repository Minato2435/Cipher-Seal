import { Link } from "react-router-dom";

function LatticeMark({ size = 72 }: { size?: number }) {
  const b1 = { x: 34, y: 0 };
  const b2 = { x: 12, y: 30 };
  const pts: { x: number; y: number }[] = [];
  for (let i = -1; i <= 4; i++)
    for (let j = -1; j <= 3; j++) pts.push({ x: i * b1.x + j * b2.x, y: i * b1.y + j * b2.y });
  return (
    <svg
      width={size}
      height={size * 0.8}
      viewBox="-40 -20 150 120"
      fill="none"
      aria-hidden="true"
      className="mx-auto block"
    >
      {pts.map((p, k) => (
        <circle key={k} cx={p.x} cy={p.y} r="1.5" fill="#201f1d" opacity="0.45" />
      ))}
      <path d="M0 0 L34 24" stroke="#201f1d" strokeWidth="1.4" transform="translate(0,0)" />
      <path d="M0 24 L34 24" stroke="#201f1d" strokeWidth="1.4" opacity="0" />
      <path d="M0 60 L34 24" stroke="#201f1d" strokeWidth="1.4" />
      <path d="M0 60 L12 12" stroke="#201f1d" strokeWidth="1.4" />
      <path d="M12 12 L34 24" stroke="#9c4a22" strokeWidth="1.7" />
      <circle cx="0" cy="60" r="2.4" fill="#201f1d" />
    </svg>
  );
}

const INSTRUMENTS = [
  {
    k: "ML-KEM",
    t: "A key with no shortcut",
    d: "Every correspondence opens with a Module-Lattice key exchange. Its security rests on a lattice problem a quantum computer cannot shorten.",
  },
  {
    k: "AES-256-GCM",
    t: "Sealed before it leaves the page",
    d: "Your letter is encrypted with the session key on your device. What travels — and what is stored — is ciphertext, never the words.",
  },
  {
    k: "ML-DSA",
    t: "A signature that proves the hand",
    d: "Each letter carries a post-quantum signature. The reader's app verifies it before a single character is shown; a broken seal is refused.",
  },
  {
    k: "Isolation Forest",
    t: "A reader over your shoulder",
    d: "An anomaly model scores every account's behaviour. Unusual patterns raise a risk band, and the interface answers — a prompt, a lock, an alert.",
  },
];

const BANDS = [
  { c: "var(--risk-calm)", n: "Calm", d: "Everything works." },
  { c: "var(--risk-elevated)", n: "Elevated", d: "Confirm your password before the next letter." },
  { c: "var(--risk-high)", n: "High", d: "Live sessions are cut; re-authenticate to resume." },
  { c: "var(--risk-critical)", n: "Critical", d: "The account is locked until an administrator restores it." },
];

export function Home() {
  return (
    <div className="frame-outer">
      <div className="risk-frame" style={{ overflow: "auto", minHeight: "100vh" }}>
        <div className="risk-plate">Calm</div>

        <div className="mx-auto max-w-[980px] px-6 md:px-10">
          {/* hero */}
          <section className="flex min-h-[88vh] flex-col justify-center py-16 text-center">
            <LatticeMark />
            <p className="mono mt-6 text-[11px] uppercase tracking-[0.34em] text-[color:var(--accent-700)]">
              quantum-safe correspondence
            </p>
            <h1
              className="font-head mt-3 leading-[1.02]"
              style={{ fontSize: "clamp(3.2rem, 9vw, 6.2rem)", fontWeight: 600 }}
            >
              Cipher &amp; Seal
            </h1>
            <p className="auth-tag !mb-0 mt-3 text-[15px]">
              Correspondence sealed against a quantum future
            </p>
            <p className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-[color:var(--n-700)]">
              A messaging console where the sealing is visible and the watching is honest.
              Post-quantum cryptography protects every letter today against the computers of
              tomorrow; an anomaly model reads the room and answers when something looks wrong.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn btn-primary !px-6 !py-2.5">
                Create an account
              </Link>
              <Link to="/login" className="btn !px-6 !py-2.5">
                Sign in
              </Link>
            </div>

            {/* the one dark surface — a still of the seal */}
            <div className="strip mx-auto mt-12 w-full max-w-lg text-left">
              <div className="strip-title">
                <span>Transformation</span>
                <span>sealed</span>
              </div>
              <div className="strip-stages">
                <span className="strip-stage done">plain</span>
                <span className="strip-arrow">→</span>
                <span className="strip-stage done">ML-KEM</span>
                <span className="strip-arrow">→</span>
                <span className="strip-stage done">AES-GCM</span>
                <span className="strip-arrow">→</span>
                <span className="strip-stage now">ML-DSA</span>
              </div>
              <div className="strip-readout">
                <span className="seal pop">✓ 3309-byte seal</span>
              </div>
            </div>
          </section>

          <hr className="hr" />

          {/* instruments */}
          <section className="py-16">
            <h2 className="font-head text-[32px]">Four instruments</h2>
            <p className="mt-1 max-w-xl text-[14.5px] leading-relaxed text-[color:var(--n-600)]">
              Two for the sealing, one for the signature, one for the watching.
            </p>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {INSTRUMENTS.map((s) => (
                <article key={s.k} className="plate">
                  <span className="pill" style={{ color: "var(--accent-700)" }}>
                    {s.k}
                  </span>
                  <h3 className="font-head mt-2.5 text-[22px]">{s.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--n-700)]">{s.d}</p>
                </article>
              ))}
            </div>
          </section>

          <hr className="hr" />

          {/* bands */}
          <section className="py-16">
            <h2 className="font-head text-[32px]">Four bands, one response</h2>
            <p className="mt-1 max-w-2xl text-[14.5px] leading-relaxed text-[color:var(--n-600)]">
              The whole console takes on the colour of your current risk band — a border at the
              screen's edge, a plate in the corner. It is not a badge; it is the room you are
              working in.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BANDS.map((b) => (
                <div key={b.n} className="border-l-2 pl-3" style={{ borderColor: b.c }}>
                  <p className="font-head text-[20px]" style={{ color: b.c }}>
                    {b.n}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[color:var(--n-700)]">{b.d}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="mono border-t border-[color:var(--divider)] py-7 text-[11px] text-[color:var(--n-500)]">
            ML-KEM-768 · ML-DSA-65 · AES-256-GCM · Isolation Forest — a final-year project, on
            Firebase.
          </footer>
        </div>
      </div>
    </div>
  );
}
