import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import type { RiskPoint } from "../lib/useCollection";

const T = { elevated: 0.444, high: 0.601, critical: 0.78 };

export function RiskTimeline({ points, label }: { points: RiskPoint[]; label: string }) {
  const data = points.map((p, i) => ({ i, score: Number(p.score.toFixed(3)) }));

  return (
    <section className="glass rounded-xl p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          risk over time
        </h2>
        <span className="font-mono text-[11px] text-muted">{label}</span>
      </div>

      <div className="mt-3 h-40">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="max-w-xs font-mono text-[12px] leading-relaxed text-faint">
              Pick a person, then run a simulation. The line steps up as their score changes.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tick={{ fill: "#5A6379", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={T.elevated} stroke="#F2A93B" strokeDasharray="2 5" strokeOpacity={0.55} />
              <ReferenceLine y={T.high} stroke="#F26430" strokeDasharray="2 5" strokeOpacity={0.55} />
              <ReferenceLine y={T.critical} stroke="#F03D5F" strokeDasharray="2 5" strokeOpacity={0.7} />
              <Line
                type="stepAfter"
                dataKey="score"
                stroke="#7C5CFF"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#3DD6D0" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
