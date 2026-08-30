import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";
import { Avatar } from "./Avatar";
import { StatusChip } from "./StatusChip";

const HUE: Record<string, string> = {
  NORMAL: "#5B6478",
  ELEVATED: "#F2A93B",
  HIGH: "#F26430",
  CRITICAL: "#F03D5F",
};

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
  const [err, setErr] = useState("");

  async function setStatus(uid: string, status: "normal" | "blocked") {
    setBusy(uid);
    setErr("");
    try {
      await api.adminSetStatus(uid, status);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't update that account.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass overflow-hidden rounded-xl">
      <header className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          people · {rows.length}
        </h2>
        {err && <span className="font-mono text-[11px] text-risk-high">{err}</span>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-faint">
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
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-faint">
                  No accounts yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.uid}
                onClick={() => onSelect(r.uid)}
                className={`cursor-pointer border-b border-line/60 last:border-0 transition ${
                  selectedUid === r.uid ? "bg-violet/10" : "hover:bg-white/[.03]"
                }`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar uid={r.uid} name={r.displayName} size={28} />
                    <div className="min-w-0">
                      <div className="truncate text-text">{r.displayName}</div>
                      <div className="truncate font-mono text-[10.5px] text-faint">{r.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 font-mono text-[10.5px] text-faint">
                  {middleTruncate(r.uid, 12)}
                </td>
                <td className="px-2 py-2.5">
                  {r.role === "admin" ? (
                    <span className="pill text-cyan">admin</span>
                  ) : (
                    <span className="font-mono text-[11px] text-faint">user</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <StatusChip status={r.status} />
                </td>
                <td className="px-2 py-2.5 font-mono text-[12px]">
                  <span style={{ color: HUE[r.band] ?? HUE.NORMAL }}>{r.band.toLowerCase()}</span>{" "}
                  <span className="text-faint">{r.score.toFixed(2)}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-2">
                    {r.status === "blocked" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus(r.uid, "normal");
                        }}
                        disabled={busy === r.uid}
                        className="rounded-md border border-risk-critical/50 px-2 py-0.5 font-mono text-[11px] text-risk-critical disabled:opacity-50"
                      >
                        {busy === r.uid ? "…" : "unblock"}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus(r.uid, "blocked");
                        }}
                        disabled={busy === r.uid}
                        className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-faint transition hover:border-risk-critical/50 hover:text-risk-critical disabled:opacity-50"
                      >
                        {busy === r.uid ? "…" : "block"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSimulate(r.uid);
                      }}
                      className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition hover:border-violet/50 hover:text-text"
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
