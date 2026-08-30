import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskPoint } from "../lib/useCollection";

// as-built seed-tuned thresholds (thresholds.json)
const T = { elevated: 0.444, high: 0.601, critical: 0.78 };

export function RiskTimeline({ points, label }: { points: RiskPoint[]; label: string }) {
  const data = points.map((p, i) => ({ i, score: Number(p.score.toFixed(3)) }));

  return (
    <section className="lit border border-ink/15 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7e8aa0]">
          risk over time
        </h2>
        <span className="font-mono text-[11px] text-[#cdd6e4]">{label}</span>
      </div>

      <div className="mt-3 h-40">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="max-w-xs font-mono text-[12px] leading-relaxed text-[#7e8aa0]">
              Pick a user row, then run a simulation. The line steps up as their score changes.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#ffffff14" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tick={{ fill: "#7e8aa0", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={T.elevated} stroke="#C98A2B" strokeDasharray="2 4" strokeOpacity={0.6} />
              <ReferenceLine y={T.high} stroke="#C1541F" strokeDasharray="2 4" strokeOpacity={0.6} />
              <ReferenceLine y={T.critical} stroke="#A01E22" strokeDasharray="2 4" strokeOpacity={0.7} />
              <Line
                type="stepAfter"
                dataKey="score"
                stroke="#86E5D0"
                strokeWidth={2}
                dot={{ r: 2, fill: "#86E5D0" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
