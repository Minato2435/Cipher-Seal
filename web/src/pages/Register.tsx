import { type FormEvent, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import { AuthShell, Field } from "../components/AuthShell";

function authMessage(code: string): string {
  if (code === "auth/email-already-in-use") return "That email is already registered.";
  if (code === "auth/invalid-email") return "That doesn't look like an email address.";
  if (code === "auth/weak-password") return "Password needs at least 6 characters.";
  return "Couldn't create the account. Try again.";
}

export function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      await api.registerKeys(name.trim() || undefined);
      nav("/", { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(authMessage(code));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create an account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-ink underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-high">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink px-4 py-2.5 font-sans text-sm font-semibold text-paper disabled:opacity-50"
        >
          {busy ? "Setting up your keys…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
