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
    <section className="card flex flex-col overflow-hidden">
      <header className="border-b border-[color:var(--divider)] px-4 py-3">
        <span className="section-title">Alerts · {open.length}</span>
      </header>
      <div className="min-h-[170px] max-h-64 flex-1 space-y-2 overflow-y-auto p-3">
        {open.length === 0 ? (
          <div className="grid h-[140px] place-items-center">
            <p className="text-[13px] text-[color:var(--n-500)]">Nothing needs attention.</p>
          </div>
        ) : (
          open.map((a) => (
            <div
              key={a.id}
              className="rounded border p-3"
              style={{ borderColor: "var(--risk-critical)", background: "var(--risk-critical-soft)" }}
            >
              <p className="text-[13px]" style={{ color: "var(--risk-critical)" }}>
                {(a.reason as string) ?? "risk escalation"}
              </p>
              <p className="mono mt-1 text-[10.5px] text-[color:var(--n-600)]">
                {middleTruncate((a.uid as string) ?? "", 14)} · {ts(a.ts)}
              </p>
              <button
                onClick={() => setAcked((s) => new Set(s).add(a.id))}
                className="btn mt-2 !px-2 !py-0.5 !text-[11px]"
              >
                Acknowledge
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
