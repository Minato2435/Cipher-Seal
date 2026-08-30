import { bandColor } from "../lib/format";
import type { RiskState } from "../lib/useRiskBand";

/** Left-rail live meter: score track, band word, model/rule split, components. */
export function RiskInstrument({ risk }: { risk: RiskState }) {
  const color = bandColor(risk.band);
  const pct = Math.round(Math.min(1, Math.max(0, risk.score)) * 100);
  const comps = Object.entries(risk.components);

  return (
    <div className="font-mono text-[12px] text-ink">
      <div className="flex items-baseline justify-between">
        <span className="uppercase tracking-[0.16em] text-ink-soft">risk</span>
        <span>{risk.loaded ? risk.score.toFixed(2) : "—"}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-ink-soft/20">
        <div
          className="h-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="mt-2 font-display text-2xl leading-none lowercase" style={{ color }}>
        {(risk.band ?? "normal").toLowerCase()}
      </p>
      <p className="mt-1 text-ink-soft">
        model {risk.modelScore.toFixed(2)} · rules {risk.ruleBoost.toFixed(2)}
      </p>
      {comps.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-ink-soft">
          {comps.map(([k, v]) => (
            <li key={k}>
              {k.replace(/_/g, " ")} +{Number(v).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
