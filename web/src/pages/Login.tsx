import { type FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import { AuthShell, Field } from "../components/AuthShell";

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await api.registerKeys().catch(() => undefined);
      nav("/", { replace: true });
    } catch {
      setError("Wrong email or password.");
      setBusy(false);
    }
  }

  return (
    <AuthShell mode="signin">
      <form onSubmit={submit}>
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@domain.com"
        />
        <Field
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />
        {error && <p className="field-error mb-3">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary btn-block">
          {busy ? (
            <>
              <span className="spin" /> Verifying signature…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
