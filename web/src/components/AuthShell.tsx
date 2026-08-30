import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthShell({ mode, children }: { mode: "signin" | "register"; children: ReactNode }) {
  return (
    <div className="frame-outer">
      <div className="risk-frame">
        <div className="auth-wrap">
          <svg
            width="52"
            height="40"
            viewBox="0 0 52 40"
            fill="none"
            className="mx-auto mb-4 block"
            aria-hidden="true"
          >
            <circle cx="8" cy="34" r="1.6" fill="#201f1d" />
            <path d="M8 34 L40 24" stroke="#201f1d" strokeWidth="1.3" />
            <path d="M8 34 L16 6" stroke="#201f1d" strokeWidth="1.3" />
            <path d="M36 21.3 L40 24 L37.6 27.6" stroke="#201f1d" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
            <path d="M12.3 12.3 L16 6 L19 9.4" stroke="#201f1d" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
          </svg>
          <div className="wordmark">Cipher &amp; Seal</div>
          <div className="auth-tag">Correspondence sealed against a quantum future</div>

          <div className="seg" style={{ marginBottom: 28 }}>
            <Link to="/login" aria-pressed={mode === "signin"} className="!no-underline">
              Sign in
            </Link>
            <Link to="/register" aria-pressed={mode === "register"} className="!no-underline">
              Register
            </Link>
          </div>

          {children}
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
