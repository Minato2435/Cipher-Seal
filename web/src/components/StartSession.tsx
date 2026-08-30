import { type FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";

export function StartSession({ onStarted }: { onStarted: (sessionId: string) => void }) {
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
      onStarted(sessionId);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PEER_NOT_READY") {
        setError("That user hasn't set up their keys yet — ask them to sign in once.");
      } else if (err instanceof ApiError && err.code === "NOT_FOUND") {
        setError("No user with that ID.");
      } else {
        setError("Couldn't start the session. Check the ID and try again.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[11px] text-ink underline decoration-dotted hover:decoration-solid"
      >
        {open ? "close" : "+ new"}
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-6 z-20 w-64 space-y-2 border border-ink/25 bg-paper p-3 shadow-lg"
        >
          <label className="block text-[12px] font-medium text-ink">
            Peer's user ID
            <input
              autoFocus
              value={peer}
              onChange={(e) => setPeer(e.target.value)}
              placeholder="uGrMQRQ…"
              className="mt-1 w-full border border-ink/25 bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:border-ink"
            />
          </label>
          <p className="text-[11px] text-ink-soft">
            They copy it from the <span className="text-ink">id</span> chip at the top of their
            sidebar.
          </p>
          {error && <p className="text-[12px] text-high">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink px-3 py-1.5 font-sans text-[12px] font-semibold text-paper disabled:opacity-50"
          >
            {busy ? "Establishing key exchange…" : "Start session"}
          </button>
        </form>
      )}
    </div>
  );
}
