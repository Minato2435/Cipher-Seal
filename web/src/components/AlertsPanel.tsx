import { useState } from "react";
import { middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";

function ts(v: unknown): string {
  const ms = (v as { toMillis?: () => number })?.toMillis?.();
  return ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function AlertsPanel({ alerts }: { alerts: Doc[] }) {
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const open = alerts.filter((a) => !a.acknowledged && !acked.has(a.id));

  return (
    <section className="glass flex flex-col overflow-hidden rounded-xl">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          alerts · {open.length}
        </h2>
      </header>
      <div className="min-h-[180px] max-h-64 flex-1 space-y-2 overflow-y-auto p-3">
        {open.length === 0 ? (
          <div className="grid h-[160px] place-items-center">
            <p className="text-[13px] text-faint">Nothing needs attention.</p>
          </div>
        ) : (
          open.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-risk-critical/45 bg-risk-critical/[0.07] p-3"
            >
              <p className="text-[13px] text-text">{(a.reason as string) ?? "risk escalation"}</p>
              <p className="mt-1 font-mono text-[10.5px] text-faint">
                {middleTruncate((a.uid as string) ?? "", 14)} · {ts(a.ts)}
              </p>
              <button
                onClick={() => setAcked((s) => new Set(s).add(a.id))}
                className="mt-2 rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted hover:border-violet/50 hover:text-text"
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
