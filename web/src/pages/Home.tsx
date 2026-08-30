import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ---------- hooks ---------- */

function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in"), delay);
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.16 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}

function useScrolled(px: number) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > px);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [px]);
  return past;
}

/* ---------- pieces ---------- */

function RevealCard({
  delay,
  children,
  style,
}: {
  delay: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = useReveal<HTMLDivElement>(delay);
  return (
    <div ref={ref} className="plate reveal" style={style}>
      {children}
    </div>
  );
}

function Wordmark() {
  return (
    <h1 className="wm font-head leading-[1.0]" style={{ fontSize: "clamp(3.4rem, 10vw, 7rem)", fontWeight: 600 }}>
      {"Cipher".split("").map((c, i) => (
        <span key={`a${i}`} style={{ animationDelay: `${0.25 + i * 0.05}s` }}>
          {c}
        </span>
      ))}
      <span style={{ animationDelay: "0.6s", margin: "0 .12em", color: "var(--accent-600)" }}>&amp;</span>
      {"Seal".split("").map((c, i) => (
        <span key={`b${i}`} style={{ animationDelay: `${0.7 + i * 0.05}s` }}>
          {c}
        </span>
      ))}
    </h1>
  );
}

function HeroLattice() {
  const b1 = { x: 40, y: 0 };
  const b2 = { x: 14, y: 34 };
  const pts: { x: number; y: number }[] = [];
  for (let i = -1; i <= 5; i++) for (let j = -1; j <= 3; j++) pts.push({ x: i * b1.x + j * b2.x, y: i * b1.y + j * b2.y });
  return (
    <svg width="150" height="120" viewBox="-30 -20 200 140" fill="none" aria-hidden="true" className="mx-auto block">
      {pts.map((p, k) => (
        <circle key={k} cx={p.x} cy={p.y} r="1.6" fill="#201f1d" className="lat-dot" style={{ animationDelay: `${0.4 + k * 0.02}s` }} />
      ))}
      <path className="lat-line d1" d="M0 60 L40 84" stroke="#201f1d" strokeWidth="1.5" strokeLinecap="round" />
      <path className="lat-line d2" d="M0 60 L14 26" stroke="#201f1d" strokeWidth="1.5" strokeLinecap="round" />
      <path className="lat-line d3" d="M14 26 L40 84" stroke="#9c4a22" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="0" cy="60" r="2.6" fill="#201f1d" />
    </svg>
  );
}

const STAGES = ["plain", "ML-KEM", "AES-GCM", "ML-DSA"];
function randHex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/** A transformation strip that plays the sealing sequence on a loop. */
function LoopingStrip() {
  const [stage, setStage] = useState(0); // 0..4  (4 = sealed & held)
  const [readout, setReadout] = useState('"the eagle lands at midnight"');

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(4);
      setReadout("✓ 3309-byte seal");
      return;
    }
    let alive = true;
    const timers: number[] = [];
    const scrambles: number[] = [];

    const run = () => {
      if (!alive) return;
      setStage(1);
      setReadout('"the eagle lands at midnight"');
      timers.push(
        window.setTimeout(() => {
          setStage(2);
          let t = 0;
          const iv = window.setInterval(() => {
            setReadout("session key  " + randHex(16));
            if (++t > 6) clearInterval(iv);
          }, 45);
          scrambles.push(iv);
        }, 900),
      );
      timers.push(
        window.setTimeout(() => {
          setStage(3);
          setReadout(randHex(48).match(/.{1,4}/g)!.join(" "));
        }, 1700),
      );
      timers.push(
        window.setTimeout(() => {
          setStage(4);
          setReadout("✓ 3309-byte seal");
        }, 2500),
      );
      timers.push(window.setTimeout(run, 5200)); // hold, then loop
    };
    run();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      scrambles.forEach(clearInterval);
    };
  }, []);

  return (
    <div className="strip mx-auto w-full max-w-lg text-left">
      <div className="strip-title">
        <span>Transformation</span>
        <span>{stage === 4 ? "sealed" : stage === 0 ? "idle" : "sealing…"}</span>
      </div>
      <div className="strip-stages">
        {STAGES.map((s, i) => {
          const cls = stage === i + 1 ? "strip-stage now" : stage > i + 1 ? "strip-stage done" : "strip-stage";
          return (
            <span key={s} className="inline-flex items-center gap-2">
              <span className={cls}>{s}</span>
              {i < STAGES.length - 1 && <span className="strip-arrow">→</span>}
            </span>
          );
        })}
      </div>
      <div className="strip-readout">
        {readout.startsWith("✓") ? <span className="seal pop">{readout}</span> : readout}
      </div>
    </div>
  );
}

/* ---------- data ---------- */

const INSTRUMENTS = [
  { k: "ML-KEM · FIPS 203", t: "A key with no shortcut", d: "Every correspondence opens with a Module-Lattice key exchange. Its security rests on a lattice problem a quantum computer cannot shorten." },
  { k: "AES-256-GCM", t: "Sealed before it leaves the page", d: "Your letter is encrypted with the session key on your device. What travels — and what is stored — is ciphertext, never the words." },
  { k: "ML-DSA · FIPS 204", t: "A signature that proves the hand", d: "Each letter carries a post-quantum signature. The reader's app verifies it before a single character is shown; a broken seal is refused." },
  { k: "Isolation Forest", t: "A reader over your shoulder", d: "An anomaly model scores every account's behaviour. Unusual patterns raise a risk band, and the interface answers — a prompt, a lock, an alert." },
];

const FLOW = [
  { n: "01", t: "Compose", d: "You write a letter in plain words." },
  { n: "02", t: "Derive", d: "ML-KEM encapsulates a fresh session key against your peer's public key." },
  { n: "03", t: "Seal", d: "AES-256-GCM encrypts the letter under that key." },
  { n: "04", t: "Sign", d: "ML-DSA signs the sealed bytes with your private key." },
  { n: "05", t: "Open", d: "Your peer verifies the signature, then decrypts. A broken seal is refused." },
];

const BANDS = [
  { k: "NORMAL", n: "Calm", c: "var(--risk-calm)", soft: "var(--risk-calm-soft)", d: "Everything works. The frame is a whisper of grey." },
  { k: "ELEVATED", n: "Elevated", c: "var(--risk-elevated)", soft: "var(--risk-elevated-soft)", d: "Confirm your password before the next letter." },
  { k: "HIGH", n: "High", c: "var(--risk-high)", soft: "var(--risk-high-soft)", d: "Live sessions are cut. Re-authenticate to resume." },
  { k: "CRITICAL", n: "Critical", c: "var(--risk-critical)", soft: "var(--risk-critical-soft)", d: "The account is locked until an administrator restores it." },
];

/* ---------- page ---------- */

export function Home() {
  const showHeader = useScrolled(420);
  const probRef = useReveal<HTMLDivElement>();
  const instRef = useReveal<HTMLDivElement>();
  const flowRef = useReveal<HTMLDivElement>();
  const bandRef = useReveal<HTMLDivElement>();
  const specRef = useReveal<HTMLDivElement>();
  const ctaRef = useReveal<HTMLDivElement>();
  const [band, setBand] = useState(BANDS[0]);

  return (
    <div className="frame-outer">
      <div className="risk-frame" style={{ overflow: "auto", minHeight: "100vh" }}>
        <header className={`landing-header${showHeader ? " show" : ""}`}>
          <span className="font-head text-lg" style={{ fontWeight: 600 }}>
            Cipher &amp; Seal
          </span>
          <nav className="flex items-center gap-3 text-[13px]">
            <Link to="/login" className="link-muted">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary !px-4 !py-1.5 !text-[13px]">
              Create an account
            </Link>
          </nav>
        </header>

        <div className="mx-auto max-w-[1000px] px-6 md:px-10">
          {/* ---- hero ---- */}
          <section className="flex min-h-[92vh] flex-col justify-center py-20 text-center">
            <HeroLattice />
            <p className="mono mt-6 text-[11px] uppercase tracking-[0.36em] text-[color:var(--accent-700)]">
              quantum-safe correspondence
            </p>
            <div className="mt-3">
              <Wordmark />
            </div>
            <p className="auth-tag !mb-0 mt-4 text-[15.5px]">
              Correspondence sealed against a quantum future
            </p>
            <p className="reveal in mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-[color:var(--n-700)]">
              A messaging console where the sealing is visible and the watching is honest.
              Post-quantum cryptography protects every letter today against the computers of
              tomorrow; an anomaly model reads the room and answers when something looks wrong.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn-cta stamp">
                <span className="wax-seal" aria-hidden>
                  ◈
                </span>
                Begin a correspondence
              </Link>
              <Link to="/login" className="btn !px-6 !py-3">
                Sign in
              </Link>
            </div>
            <div className="mt-14">
              <LoopingStrip />
            </div>
          </section>

          <hr className="hr" />

          {/* ---- the problem ---- */}
          <section ref={probRef} className="reveal py-20">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent-700)]">
              why this exists
            </p>
            <h2 className="font-head mt-2 text-[clamp(1.9rem,4vw,2.7rem)] leading-tight">
              Harvest now, decrypt later
            </h2>
            <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[color:var(--n-700)]">
              An adversary does not need a quantum computer today. They only need to record your
              encrypted traffic today and wait. When a large quantum computer arrives, the classical
              key that protected it falls in hours. Everything ever sent under it is readable.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="plate">
                <span className="pill" style={{ color: "var(--risk-high)" }}>
                  classical · RSA / ECC
                </span>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[color:var(--n-700)]">
                  Security rests on factoring or discrete logs — problems Shor's algorithm solves
                  efficiently on a quantum computer. A recorded session is a time bomb.
                </p>
              </div>
              <div className="plate" style={{ borderColor: "var(--accent-500)" }}>
                <span className="pill" style={{ color: "var(--accent-700)" }}>
                  post-quantum · ML-KEM
                </span>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[color:var(--n-700)]">
                  Security rests on finding short vectors in a high-dimensional lattice — with no
                  known quantum shortcut. Recorded today, still sealed decades from now.
                </p>
              </div>
            </div>
          </section>

          <hr className="hr" />

          {/* ---- four instruments ---- */}
          <section ref={instRef} className="reveal py-20">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent-700)]">
              the mechanism
            </p>
            <h2 className="font-head mt-2 text-[clamp(1.9rem,4vw,2.7rem)]">Four instruments</h2>
            <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[color:var(--n-600)]">
              Two for the sealing, one for the signature, one for the watching.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {INSTRUMENTS.map((s, i) => (
                <RevealCard key={s.k} delay={80 + i * 90}>
                  <span className="pill" style={{ color: "var(--accent-700)" }}>
                    {s.k}
                  </span>
                  <h3 className="font-head mt-2.5 text-[22px]">{s.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--n-700)]">{s.d}</p>
                </RevealCard>
              ))}
            </div>
          </section>

          <hr className="hr" />

          {/* ---- how a letter travels ---- */}
          <section ref={flowRef} className="reveal py-20">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent-700)]">
              end to end
            </p>
            <h2 className="font-head mt-2 text-[clamp(1.9rem,4vw,2.7rem)]">How a letter travels</h2>
            <div className="flow mt-10">
              {FLOW.map((f) => (
                <div key={f.n} className="flow-step">
                  <span className="flow-num">{f.n}</span>
                  <div>
                    <p className="font-head text-[17px]">{f.t}</p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[color:var(--n-600)]">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="hr" />

          {/* ---- four bands ---- */}
          <section ref={bandRef} className="reveal py-20">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent-700)]">
              adaptive response
            </p>
            <h2 className="font-head mt-2 text-[clamp(1.9rem,4vw,2.7rem)]">Four bands, one response</h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-[color:var(--n-600)]">
              The whole console takes on the colour of your current risk band — a border at the
              screen's edge, a plate in the corner. Not a badge; the room you are working in.
            </p>

            <div className="mt-8 grid items-start gap-6 md:grid-cols-[1fr_260px]">
              <div className="grid gap-2 sm:grid-cols-2">
                {BANDS.map((b) => (
                  <button
                    key={b.k}
                    onMouseEnter={() => setBand(b)}
                    onFocus={() => setBand(b)}
                    onClick={() => setBand(b)}
                    className="rounded border p-3 text-left transition"
                    style={{
                      borderColor: band.k === b.k ? b.c : "var(--divider-strong)",
                      background: band.k === b.k ? b.soft : "transparent",
                    }}
                  >
                    <span className="font-head text-[18px]" style={{ color: b.c }}>
                      {b.n}
                    </span>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-[color:var(--n-700)]">
                      {b.d}
                    </p>
                  </button>
                ))}
              </div>

              <div
                className="band-preview grid h-[180px] place-items-center p-4 text-center"
                style={
                  {
                    "--sel-band": band.c,
                    "--sel-band-soft": band.soft,
                  } as React.CSSProperties
                }
              >
                <div>
                  <p className="mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--n-500)]">
                    frame preview
                  </p>
                  <p className="font-head mt-1 text-[26px]" style={{ color: band.c }}>
                    {band.n}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="hr" />

          {/* ---- spec strip ---- */}
          <section ref={specRef} className="reveal py-16">
            <div className="instrument">
              <div className="instrument-title">Built on</div>
              <div className="mono flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#c9bd9d]">
                <span>ML-KEM-768</span>
                <span>ML-DSA-65</span>
                <span>AES-256-GCM</span>
                <span>HKDF-SHA256</span>
                <span>Isolation Forest</span>
                <span>Cloud Functions · Python 3.12</span>
                <span>Firestore</span>
                <span>React · Vite</span>
              </div>
              <p className="mt-3 text-[11px] text-[#8f8570]">
                A final-year project. The PQC primitives are reference (FIPS 203 / 204)
                implementations; sealing is server-mediated — client-side WASM is future work.
              </p>
            </div>
          </section>

          {/* ---- final CTA ---- */}
          <section ref={ctaRef} className="reveal py-24 text-center">
            <h2 className="font-head text-[clamp(2.2rem,6vw,4rem)] leading-tight">
              Write something worth sealing.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn-cta stamp">
                <span className="wax-seal" aria-hidden>
                  ◈
                </span>
                Create an account
              </Link>
              <Link to="/login" className="btn !px-6 !py-3">
                Sign in
              </Link>
            </div>
          </section>

          <footer className="mono border-t border-[color:var(--divider)] py-7 text-[11px] text-[color:var(--n-500)]">
            Cipher &amp; Seal — quantum-safe correspondence.
          </footer>
        </div>
      </div>
    </div>
  );
}
