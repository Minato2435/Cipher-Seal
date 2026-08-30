import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "../lib/useAuthUser";
import { useRiskBand } from "../lib/useRiskBand";
import { useCollection, useRiskHistory } from "../lib/useCollection";
import { RiskFrame } from "../components/RiskFrame";
import { UserTable } from "../components/UserTable";
import { RiskTimeline } from "../components/RiskTimeline";
import { AlertsPanel } from "../components/AlertsPanel";
import { EventFeed } from "../components/EventFeed";
import { AttackSim } from "../components/AttackSim";

export function Admin() {
  const { user } = useAuthUser();
  const myRisk = useRiskBand(user?.uid);

  const users = useCollection("users");
  const risks = useCollection("riskScores");
  const alerts = useCollection("alerts", { orderByField: "ts", direction: "desc", limit: 50 });
  const events = useCollection("securityEvents", {
    orderByField: "ts",
    direction: "desc",
    limit: 120,
  });

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [simTarget, setSimTarget] = useState<string | null>(null);
  const history = useRiskHistory(selectedUid ?? undefined);

  const selectedLabel = useMemo(() => {
    const u = users.find((x) => x.id === selectedUid);
    return u
      ? (u.displayName as string) || (u.email as string) || (selectedUid ?? "")
      : "no user selected";
  }, [users, selectedUid]);

  const activeSessions = 0; // sessions list is participant-scoped; count omitted for admins

  return (
    <RiskFrame band={myRisk.band}>
      <main className="lattice-ground min-h-screen px-6 pb-16 pt-12 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                quantum-safe communication
              </p>
              <h1 className="mt-1 font-display text-5xl leading-none text-ink">Security monitor</h1>
              <p className="mt-2 font-mono text-[12px] text-ink-soft">
                {users.length} users
                {activeSessions ? ` · ${activeSessions} active sessions` : ""} ·{" "}
                {alerts.filter((a) => !a.acknowledged).length} open alerts
              </p>
            </div>
            <Link
              to="/"
              className="mt-1 inline-flex items-center gap-1.5 border border-ink/20 px-2.5 py-1 font-mono text-[12px] text-ink hover:border-ink/50"
            >
              <span aria-hidden>←</span> chat
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            <UserTable
              users={users}
              risks={risks}
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
              onSimulate={(uid) => {
                setSelectedUid(uid);
                setSimTarget(uid);
              }}
            />

            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RiskTimeline points={history} label={selectedLabel} />
              </div>
              <AlertsPanel alerts={alerts} />
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EventFeed events={events} />
              </div>
              <AttackSim targetUid={simTarget} />
            </div>
          </div>
        </div>
      </main>
    </RiskFrame>
  );
}
