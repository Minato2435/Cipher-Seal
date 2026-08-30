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
    <section className="border border-ink/15 bg-white/70">
      <header className="border-b border-ink/10 px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          event feed
        </h2>
      </header>
      <div className="max-h-72 divide-y divide-ink/5 overflow-y-auto font-mono text-[12px]">
        {events.length === 0 ? (
          <p className="px-4 py-6 text-center text-ink-soft">No events recorded.</p>
        ) : (
          events.map((e) => {
            const type = (e.type as string) ?? "";
            return (
              <div key={e.id} className="flex items-baseline gap-3 px-4 py-1.5">
                <span className="text-ink-soft/80">{ts(e.ts)}</span>
                <span
                  className={`w-32 shrink-0 ${HOT.has(type) ? "text-high" : "text-ink"}`}
                >
                  {type}
                </span>
                <span className="w-24 shrink-0 text-ink-soft">
                  {middleTruncate((e.uid as string) ?? "", 10)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">
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
