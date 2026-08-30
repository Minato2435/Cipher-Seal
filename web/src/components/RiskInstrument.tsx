import type { RiskState } from "../lib/useRiskBand";

const HUE: Record<string, string> = {
  NORMAL: "#5B6478",
  ELEVATED: "#F2A93B",
  HIGH: "#F26430",
  CRITICAL: "#F03D5F",
};

export function RiskInstrument({ risk }: { risk: RiskState }) {
  const color = HUE[risk.band] ?? HUE.NORMAL;
  const pct = Math.round(Math.min(1, Math.max(0, risk.score)) * 100);
  const comps = Object.entries(risk.components);

  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">risk</span>
        <span className="font-mono text-[12px] tabular-nums text-text">
          {risk.loaded ? risk.score.toFixed(2) : "—"}
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </div>

      <p
        className="mt-2.5 font-display text-2xl font-semibold lowercase leading-none"
        style={{ color, textShadow: `0 0 24px ${color}66` }}
      >
        {(risk.band ?? "normal").toLowerCase()}
      </p>
      <p className="mt-1 font-mono text-[11px] text-faint">
        model {risk.modelScore.toFixed(2)} <span className="text-white/15">·</span> rules{" "}
        {risk.ruleBoost.toFixed(2)}
      </p>

      {comps.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[11px]">
          {comps.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between text-muted">
              <span>{k.replace(/_/g, " ")}</span>
              <span className="font-mono tabular-nums" style={{ color }}>
                +{Number(v).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
