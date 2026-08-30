import { useState } from "react";
import { middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";

function ts(v: unknown): string {
  const ms = (v as { toMillis?: () => number })?.toMillis?.();
  return ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function AlertsPanel({ alerts }: { alerts: Doc[] }) {
  // acknowledge is functions-only to persist; for the demo it's local-only.
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const open = alerts.filter((a) => !a.acknowledged && !acked.has(a.id));

  return (
    <section className="border border-ink/15 bg-white/70">
      <header className="border-b border-ink/10 px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          alerts · {open.length}
        </h2>
      </header>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3">
        {open.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">Nothing needs attention.</p>
        ) : (
          open.map((a) => (
            <div key={a.id} className="border border-critical/45 bg-critical/[0.04] p-3">
              <p className="text-[13px] text-ink">{(a.reason as string) ?? "risk escalation"}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-soft">
                {middleTruncate((a.uid as string) ?? "", 16)} · {ts(a.ts)}
              </p>
              <button
                onClick={() => setAcked((s) => new Set(s).add(a.id))}
                className="mt-2 border border-ink/25 px-2 py-0.5 font-mono text-[11px] hover:border-ink/50"
              >
                acknowledge
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
