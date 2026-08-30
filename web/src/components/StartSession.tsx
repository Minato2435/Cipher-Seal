import { type FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";

export function StartSession({
  onStarted,
}: {
  onStarted: (sessionId: string, peerUid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [peer, setPeer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const uid = peer.trim();
    if (!uid) return;
    setBusy(true);
    setError("");
    try {
      const { sessionId } = await api.establishSession(uid);
      setPeer("");
      setOpen(false);
      onStarted(sessionId, uid);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PEER_NOT_READY")
        setError("That user hasn't set up their keys yet — ask them to sign in once.");
      else if (err instanceof ApiError && err.code === "NOT_FOUND") setError("No user with that ID.");
      else setError("Couldn't start the session. Check the ID and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition hover:border-violet/60 hover:text-text"
        aria-label="New conversation"
      >
        {open ? "×" : "+"}
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="glass absolute right-0 top-9 z-30 w-72 space-y-2.5 rounded-xl p-3.5 shadow-2xl"
        >
          <label className="block text-[12px] font-medium text-text">
            Peer's user ID
            <input
              autoFocus
              value={peer}
              onChange={(e) => setPeer(e.target.value)}
              placeholder="uGrMQRQ…"
              className="input mt-1.5 font-mono text-[12px]"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-faint">
            They copy it from the <span className="text-muted">id</span> chip at the top of their
            sidebar.
          </p>
          {error && <p className="text-[12px] text-risk-high">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Running key exchange…" : "Start secure channel"}
          </button>
        </form>
      )}
    </div>
  );
}
