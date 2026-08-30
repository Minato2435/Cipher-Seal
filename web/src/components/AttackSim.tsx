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
      setResult(
        e instanceof ApiError && e.code === "FORBIDDEN"
          ? "Only an admin can target another user."
          : "Couldn't run the simulation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <span className="section-title">Attack simulator</span>

      <div className="field mt-3">
        <label>Target user ID</label>
        <input
          className="input mono"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          placeholder="pick a row above, or paste an ID"
        />
      </div>
      {targetUid && (
        <p className="mono -mt-1 mb-2 text-[10.5px] text-[color:var(--n-500)]">
          selected: {middleTruncate(targetUid, 14)}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className="btn !px-2.5 !py-1 !text-[11.5px]"
            style={
              kind === k.id
                ? { borderColor: "var(--accent-600)", color: "var(--accent-800)", background: "var(--accent-100)" }
                : undefined
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      <button onClick={run} disabled={busy || !uid.trim()} className="btn btn-primary mt-3">
        {busy ? "Running…" : "Run simulation"}
      </button>

      {result && <p className="mt-2 text-[12px] text-[color:var(--n-600)]">{result}</p>}
    </section>
  );
}
