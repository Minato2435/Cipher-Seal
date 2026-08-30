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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[13px] text-ink underline decoration-dotted"
      >
        + new session
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-[13px] font-medium text-ink">
        Peer's user ID
        <input
          autoFocus
          value={peer}
          onChange={(e) => setPeer(e.target.value)}
          placeholder="uGrMQRQ…"
          className="mt-1 w-full border border-ink-soft/50 bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:border-ink"
        />
      </label>
      <p className="text-[11px] text-ink-soft">They copy it from the top of their own sidebar.</p>
      {error && <p className="text-[12px] text-high">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-3 py-1 font-sans text-[12px] font-semibold text-paper disabled:opacity-50"
        >
          {busy ? "Establishing…" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="px-2 py-1 font-mono text-[12px] text-ink-soft underline"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
