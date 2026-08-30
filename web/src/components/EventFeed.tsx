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
    <section className="glass overflow-hidden rounded-xl">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">event feed</h2>
      </header>
      <div className="max-h-72 divide-y divide-line/60 overflow-y-auto font-mono text-[12px]">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-faint">No events recorded.</p>
        ) : (
          events.map((e) => {
            const type = (e.type as string) ?? "";
            return (
              <div key={e.id} className="flex items-baseline gap-3 px-4 py-1.5">
                <span className="text-faint">{ts(e.ts)}</span>
                <span
                  className={`w-32 shrink-0 ${HOT.has(type) ? "text-risk-high" : "text-text"}`}
                >
                  {type}
                </span>
                <span className="w-20 shrink-0 text-faint">
                  {middleTruncate((e.uid as string) ?? "", 8)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">
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
