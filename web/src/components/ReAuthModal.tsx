import { type FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export function ReAuthModal({
  onConfirmed,
  onCancel,
}: {
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { ok } = await api.reauth(password);
      if (ok) onConfirmed();
      else setError("That password didn't match.");
    } catch {
      setError("That password didn't match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-base/70 px-6 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="glass w-full max-w-sm rounded-2xl p-6">
        <h2 className="font-display text-xl font-semibold text-text">Confirm it's you</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Your recent activity looked unusual. Re-enter your password to keep sending.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            ref={ref}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="current-password"
          />
          {error && <p className="text-[12px] text-risk-high">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button type="button" onClick={onCancel} className="btn">
              cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
