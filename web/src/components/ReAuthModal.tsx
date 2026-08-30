import { type FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/** Shown when the risk engine wants the user to confirm identity before sending. */
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-6">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm bg-paper p-6 shadow-xl">
        <h2 className="font-display text-2xl text-ink">Confirm it's you</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Your recent activity looked unusual. Re-enter your password to keep sending.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            ref={ref}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink-soft/50 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-ink"
            autoComplete="current-password"
          />
          {error && <p className="text-[12px] text-high">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-ink px-4 py-2 font-sans text-sm font-semibold text-paper disabled:opacity-50"
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 font-mono text-[12px] text-ink-soft underline"
            >
              cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
