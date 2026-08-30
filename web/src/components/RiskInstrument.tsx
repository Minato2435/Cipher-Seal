import type { RiskState } from "../lib/useRiskBand";

const LABEL: Record<string, string> = {
  NORMAL: "Calm",
  ELEVATED: "Elevated",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** The dark wax instrument set into the rail — mirrors the risk plate. */
export function RiskInstrument({ risk }: { risk: RiskState }) {
  const pct = Math.round(Math.min(1, Math.max(0, risk.score)) * 100);
  const comps = Object.entries(risk.components);

  return (
    <div className="instrument">
      <div className="instrument-title">Live signal</div>
      <div className="instrument-band">{LABEL[risk.band] ?? "Calm"}</div>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${risk.loaded ? pct : 8}%` }} />
      </div>
      <div className="instrument-split">
        {risk.loaded
          ? `model ${risk.modelScore.toFixed(2)} · rules ${risk.ruleBoost.toFixed(2)}`
          : "awaiting signal"}
      </div>
      {comps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {comps.map(([k, v]) => (
            <span
              key={k}
              className="pill"
              style={{ color: "var(--risk-color)", transition: "color 1.1s ease" }}
            >
              {k.replace(/_/g, " ")} +{Number(v).toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
