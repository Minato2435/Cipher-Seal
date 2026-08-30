import type { ReactNode } from "react";
import { Link } from "react-router-dom";

function StageLattice() {
  const b1 = { x: 44, y: 0 };
  const b2 = { x: 16, y: 38 };
  const pts: { x: number; y: number }[] = [];
  for (let i = -1; i <= 5; i++)
    for (let j = -1; j <= 4; j++) pts.push({ x: i * b1.x + j * b2.x, y: i * b1.y + j * b2.y });
  return (
    <svg width="190" height="150" viewBox="-30 -20 240 170" fill="none" aria-hidden="true">
      {pts.map((p, k) => (
        <circle
          key={k}
          cx={p.x}
          cy={p.y}
          r="1.7"
          fill="#e7ddc9"
          className="lat-dot"
          style={{ animationDelay: `${0.3 + k * 0.02}s` }}
        />
      ))}
      <path className="lat-line d1" d="M0 76 L44 100" stroke="#e7ddc9" strokeWidth="1.5" strokeLinecap="round" />
      <path className="lat-line d2" d="M0 76 L16 30" stroke="#e7ddc9" strokeWidth="1.5" strokeLinecap="round" />
      <path className="lat-line d3" d="M16 30 L44 100" stroke="#cca452" strokeWidth="2" strokeLinecap="round" />
      <circle cx="0" cy="76" r="2.8" fill="#e7ddc9" />
    </svg>
  );
}

const COPY = {
  signin: { h: "Welcome back", s: "Your keypair is unlocked on this device." },
  register: { h: "Create your account", s: "Registering generates your post-quantum keypair." },
};

export function AuthShell({ mode, children }: { mode: "signin" | "register"; children: ReactNode }) {
  const c = COPY[mode];
  return (
    <div className="frame-outer">
      <div className="risk-frame">
        <div className="auth-split">
          {/* dark wax stage */}
          <aside className="auth-stage">
            <div className="auth-stage-wordmark">Cipher &amp; Seal</div>

            <div>
              <StageLattice />
              <p className="auth-stage-quote mt-6">
                Correspondence sealed against a quantum future.
              </p>
              <p className="auth-stage-sub">
                Post-quantum cryptography protects every letter today against the computers of
                tomorrow. An anomaly model watches, and the interface answers when something looks
                wrong.
              </p>
            </div>

            <div className="auth-stage-foot">ML-KEM-768 · ML-DSA-65 · AES-256-GCM</div>
          </aside>

          {/* form panel */}
          <div className="auth-panel">
            <div className="auth-panel-inner">
              <h1 className="font-head text-[26px]" style={{ fontWeight: 600 }}>
                {c.h}
              </h1>
              <p className="mt-1 text-[13.5px] text-[color:var(--n-600)]">{c.s}</p>

              <div className="seg" style={{ margin: "22px 0 20px" }}>
                <Link to="/login" aria-pressed={mode === "signin"} className="!no-underline">
                  Sign in
                </Link>
                <Link to="/register" aria-pressed={mode === "register"} className="!no-underline">
                  Register
                </Link>
              </div>

              {children}

              <p className="mt-5 text-center text-[12px] text-[color:var(--n-500)]">
                <Link to="/" className="link-muted">
                  ← back to the front page
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label>{label}</label>
      <input {...props} className="input" />
    </div>
  );
}
