import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { middleTruncate } from "../lib/format";

const KINDS = [
  { id: "brute_force", label: "brute force" },
  { id: "msg_flood", label: "message flood" },
  { id: "off_hours_burst", label: "off-hours burst" },
];

export function AttackSim({ targetUid }: { targetUid: string | null }) {
  const [uid, setUid] = useState(targetUid ?? "");
  const [kind, setKind] = useState("brute_force");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    if (targetUid) setUid(targetUid);
  }, [targetUid]);

  async function run() {
    if (!uid.trim()) return;
    setBusy(true);
    setResult("");
    try {
      const { events } = await api.simulateAttack(kind, uid.trim());
      setResult(`Wrote ${events} events — watch the monitor.`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "FORBIDDEN")
        setResult("Only an admin can target another user.");
      else setResult("Couldn't run the simulation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-ink/15 bg-white/70 p-4">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        attack simulator
      </h2>

      <label className="mt-3 block text-[12px] font-medium text-ink">
        target user ID
        <input
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          placeholder="pick a row above, or paste an ID"
          className="mt-1 w-full border border-ink/25 bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:border-ink"
        />
      </label>
      {targetUid && (
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          selected: {middleTruncate(targetUid, 16)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`border px-2 py-1 font-mono text-[11px] lowercase transition ${
              kind === k.id ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink/50"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <button
        onClick={run}
        disabled={busy || !uid.trim()}
        className="mt-3 bg-ink px-3 py-1.5 font-sans text-[12px] font-semibold text-paper disabled:opacity-40"
      >
        {busy ? "Running…" : "Run simulation"}
      </button>

      {result && <p className="mt-2 font-mono text-[11px] text-ink-soft">{result}</p>}
    </section>
  );
}
