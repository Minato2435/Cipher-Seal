import { bandColor } from "../lib/format";
import type { RiskState } from "../lib/useRiskBand";

/**
 * Left-rail live meter, rendered as a lit instrument panel set into the paper.
 * Score track, band word, model/rule split, and any rule components.
 */
export function RiskInstrument({ risk }: { risk: RiskState }) {
  const color = bandColor(risk.band);
  const pct = Math.round(Math.min(1, Math.max(0, risk.score)) * 100);
  const comps = Object.entries(risk.components);

  return (
    <div className="lit px-4 py-3 font-mono text-[11px]">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] text-[#7e8aa0]">
        <span>risk</span>
        <span className="tabular-nums text-[#cdd6e4]">{risk.loaded ? risk.score.toFixed(2) : "—"}</span>
      </div>

      <div className="mt-2 h-1 w-full bg-white/10">
        <div
          className="h-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>

      <p className="mt-2.5 font-display text-[26px] leading-none lowercase" style={{ color }}>
        {(risk.band ?? "normal").toLowerCase()}
      </p>

      <p className="mt-1 text-[#7e8aa0]">
        model {risk.modelScore.toFixed(2)} <span className="text-white/20">·</span> rules{" "}
        {risk.ruleBoost.toFixed(2)}
      </p>

      {comps.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 text-[#a7b1c4]">
          {comps.map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span>{k.replace(/_/g, " ")}</span>
              <span className="tabular-nums" style={{ color }}>
                +{Number(v).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
