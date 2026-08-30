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
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" className="dialog">
        <div className="dialog-title">Confirm it's you</div>
        <div className="dialog-body">
          Your recent activity looked unusual. Re-enter your password to keep sending.
        </div>
        <form onSubmit={submit}>
          <input
            ref={ref}
            type="password"
            className="input"
            style={{ marginBottom: 12 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="field-error" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onCancel} className="btn">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Checking…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
