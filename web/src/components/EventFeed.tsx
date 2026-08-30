import { middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";

const HOT = new Set(["TAMPER", "LOGIN_FAIL", "SIM_ATTACK", "RE_AUTH_FAIL"]);

function ts(v: unknown): string {
  const ms = (v as { toMillis?: () => number })?.toMillis?.();
  return ms
    ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";
}

function detail(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([k]) => k !== "simulated")
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
}

export function EventFeed({ events }: { events: Doc[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-[color:var(--divider)] px-4 py-3">
        <span className="section-title">Event feed</span>
      </header>
      <div className="mono max-h-72 divide-y divide-[color:var(--divider)] overflow-y-auto text-[12px]">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-[color:var(--n-500)]">No events recorded.</p>
        ) : (
          events.map((e) => {
            const type = (e.type as string) ?? "";
            return (
              <div key={e.id} className="flex items-baseline gap-3 px-4 py-1.5">
                <span className="text-[color:var(--n-500)]">{ts(e.ts)}</span>
                <span
                  className="w-32 shrink-0"
                  style={{ color: HOT.has(type) ? "var(--risk-high)" : "var(--text)" }}
                >
                  {type}
                </span>
                <span className="w-20 shrink-0 text-[color:var(--n-500)]">
                  {middleTruncate((e.uid as string) ?? "", 8)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[color:var(--n-600)]">
                  {detail(e.meta as Record<string, unknown>)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
