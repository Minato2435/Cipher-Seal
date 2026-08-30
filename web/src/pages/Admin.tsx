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
      <div className="h-screen overflow-y-auto px-6 pb-14 pt-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-title" style={{ color: "var(--accent-700)" }}>
                Cipher &amp; Seal
              </p>
              <h1 className="font-head mt-1 text-[34px]">Security monitor</h1>
              <p className="mt-1 text-[13px] text-[color:var(--n-600)]">
                {users.length} accounts · {openAlerts} open {openAlerts === 1 ? "alert" : "alerts"}
              </p>
            </div>
            <Link to="/" className="btn !px-3 !py-1.5 !text-[13px]">
              ← Correspondence
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
      </div>
    </RiskFrame>
  );
}
