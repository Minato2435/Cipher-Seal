import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { middleTruncate } from "../lib/format";
import type { Doc } from "../lib/useCollection";
import { StatusChip } from "./StatusChip";

const HUE: Record<string, string> = {
  NORMAL: "var(--n-600)",
  ELEVATED: "var(--risk-elevated)",
  HIGH: "var(--risk-high)",
  CRITICAL: "var(--risk-critical)",
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
    <section className="card overflow-hidden">
      <header className="flex items-baseline justify-between border-b border-[color:var(--divider)] px-4 py-3">
        <span className="section-title">Correspondents · {rows.length}</span>
        {err && <span className="field-error">{err}</span>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-[color:var(--divider)] text-left">
              {["Person", "ID", "Role", "Status", "Band · score", ""].map((h, i) => (
                <th
                  key={i}
                  className={`section-title px-4 py-2.5 !text-[10.5px] ${i === 5 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[color:var(--n-500)]">
                  No accounts yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.uid}
                onClick={() => onSelect(r.uid)}
                className="cursor-pointer border-b border-[color:var(--divider)] last:border-0"
                style={selectedUid === r.uid ? { background: "var(--accent-100)" } : undefined}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{r.displayName}</div>
                  <div className="text-[11px] text-[color:var(--n-600)]">{r.email}</div>
                </td>
                <td className="mono px-4 py-3 text-[11px] text-[color:var(--n-600)]">
                  {middleTruncate(r.uid, 12)}
                </td>
                <td className="px-4 py-3">
                  {r.role === "admin" ? (
                    <span className="pill" style={{ color: "var(--accent-700)" }}>
                      admin
                    </span>
                  ) : (
                    <span className="text-[12px] text-[color:var(--n-500)]">user</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={r.status} />
                </td>
                <td className="mono px-4 py-3 text-[12px]">
                  <span style={{ color: HUE[r.band] ?? HUE.NORMAL }}>{r.band.toLowerCase()}</span>{" "}
                  <span className="text-[color:var(--n-600)]">{r.score.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    {r.status === "blocked" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus(r.uid, "normal");
                        }}
                        disabled={busy === r.uid}
                        className="btn !px-2.5 !py-1 !text-[11.5px]"
                        style={{ borderColor: "var(--risk-critical)", color: "var(--risk-critical)" }}
                      >
                        {busy === r.uid ? "…" : "Unblock"}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void setStatus(r.uid, "blocked");
                        }}
                        disabled={busy === r.uid}
                        className="btn !px-2.5 !py-1 !text-[11.5px]"
                      >
                        {busy === r.uid ? "…" : "Block"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSimulate(r.uid);
                      }}
                      className="btn !px-2.5 !py-1 !text-[11.5px]"
                    >
                      Simulate ▾
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
