import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { bandColor, middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";
import { StatusChip } from "./StatusChip";

interface Row {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  band: string;
  score: number;
}

function join(users: Doc[], risks: Doc[]): Row[] {
  const byId = new Map(risks.map((r) => [r.id, r]));
  return users
    .map((u) => {
      const r = byId.get(u.id);
      return {
        uid: u.id,
        displayName: (u.displayName as string) || (u.email as string)?.split("@")[0] || u.id,
        email: (u.email as string) ?? "",
        role: (u.role as string) ?? "user",
        status: (u.status as string) ?? "normal",
        band: (r?.band as string) ?? "NORMAL",
        score: (r?.score as number) ?? 0,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function UserTable({
  users,
  risks,
  selectedUid,
  onSelect,
  onSimulate,
}: {
  users: Doc[];
  risks: Doc[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
  onSimulate: (uid: string) => void;
}) {
  const rows = join(users, risks);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");

  async function unblock(uid: string) {
    setBusy(uid);
    setErr("");
    try {
      await api.adminSetStatus(uid, "normal");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't update that account.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border border-ink/15 bg-white/70">
      <header className="flex items-baseline justify-between border-b border-ink/10 px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          users · {rows.length}
        </h2>
        {err && <span className="font-mono text-[11px] text-high">{err}</span>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-ink/10 text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-2 font-normal">person</th>
              <th className="px-2 py-2 font-normal">id</th>
              <th className="px-2 py-2 font-normal">role</th>
              <th className="px-2 py-2 font-normal">status</th>
              <th className="px-2 py-2 font-normal">band · score</th>
              <th className="px-4 py-2 text-right font-normal">actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-soft">
                  No users yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.uid}
                onClick={() => onSelect(r.uid)}
                className={`cursor-pointer border-b border-ink/5 last:border-0 ${
                  selectedUid === r.uid ? "bg-paper" : "hover:bg-paper/60"
                }`}
              >
                <td className="px-4 py-2">
                  <div className="text-ink">{r.displayName}</div>
                  <div className="font-mono text-[11px] text-ink-soft">{r.email}</div>
                </td>
                <td className="px-2 py-2 font-mono text-[11px] text-ink-soft">
                  {middleTruncate(r.uid, 14)}
                </td>
                <td className="px-2 py-2">
                  {r.role === "admin" ? (
                    <span className="border border-ink/40 px-1.5 py-0.5 font-mono text-[10px]">
                      admin
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-ink-soft">user</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <StatusChip status={r.status} />
                </td>
                <td className="px-2 py-2 font-mono text-[12px]">
                  <span style={{ color: bandColor(r.band) }}>{r.band.toLowerCase()}</span>{" "}
                  <span className="text-ink-soft">{r.score.toFixed(2)}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-2">
                    {r.status === "blocked" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void unblock(r.uid);
                        }}
                        disabled={busy === r.uid}
                        className="border border-critical/50 px-2 py-0.5 font-mono text-[11px] text-critical disabled:opacity-50"
                      >
                        {busy === r.uid ? "…" : "unblock"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSimulate(r.uid);
                      }}
                      className="border border-ink/25 px-2 py-0.5 font-mono text-[11px] text-ink hover:border-ink/50"
                    >
                      simulate ▾
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
