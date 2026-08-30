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
      else setError("Couldn't begin the correspondence. Check the ID and try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <span className="section-title">Correspondents</span>
        <button
          className="icon-btn"
          aria-label={open ? "Close" : "New correspondent"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={open ? "M2 2l8 8M10 2l-8 8" : "M6 1v10M1 6h10"}
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="new-session-form mb-3">
          <div className="field" style={{ marginBottom: 8 }}>
            <label htmlFor="peerId">Peer's user ID</label>
            <input
              id="peerId"
              autoFocus
              className="input mono"
              value={peer}
              onChange={(e) => setPeer(e.target.value)}
              placeholder="e.g. a41c…08f2"
            />
          </div>
          <p className="mb-2 text-[11.5px] text-[color:var(--n-500)]">
            They copy it from the id chip at the top of their sidebar.
          </p>
          {error && <p className="field-error mb-2">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-block !py-2 !text-[12.5px]">
            {busy ? "Running key exchange…" : "Run key exchange"}
          </button>
        </form>
      )}
    </>
  );
}
