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
      : "no person selected";
  }, [users, selectedUid]);

  const openAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <RiskFrame band={myRisk.band}>
      <main className="min-h-screen px-5 pb-16 pt-14 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan">
                quantum-safe communication
              </p>
              <h1 className="mt-1.5 font-display text-[46px] font-semibold leading-none text-text">
                Security monitor
              </h1>
              <p className="mt-2 font-mono text-[12px] text-faint">
                {users.length} accounts · {openAlerts} open{" "}
                {openAlerts === 1 ? "alert" : "alerts"}
              </p>
            </div>
            <Link
              to="/"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-mono text-[12px] text-text transition hover:border-violet/50"
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
