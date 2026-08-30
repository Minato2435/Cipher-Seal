import { type FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
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
      // Idempotent — covers accounts made before this app existed.
      await api.registerKeys().catch(() => undefined);
      nav("/", { replace: true });
    } catch {
      setError("Wrong email or password.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-ink underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-high">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink px-4 py-2.5 font-sans text-sm font-semibold text-paper disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
