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
    <section className="instrument">
      <div className="flex items-baseline justify-between">
        <span className="instrument-title !mb-0">Risk over time</span>
        <span className="mono text-[11px] text-[#a89c80]">{label}</span>
      </div>

      <div className="mt-3 h-40">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="mono text-[11.5px] leading-relaxed text-[#8f8570]">
              Pick a person, then run a simulation. The line steps up as their score changes.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#ffffff12" vertical={false} />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tick={{ fill: "#8f8570", fontSize: 10, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={T.elevated} stroke="#996a28" strokeDasharray="3 4" strokeOpacity={0.7} />
              <ReferenceLine y={T.high} stroke="#9c4a22" strokeDasharray="3 4" strokeOpacity={0.7} />
              <ReferenceLine y={T.critical} stroke="#7a1f1f" strokeDasharray="3 4" strokeOpacity={0.85} />
              <Line
                type="stepAfter"
                dataKey="score"
                stroke="#cca452"
                strokeWidth={2.2}
                dot={{ r: 2.4, fill: "#cca452" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
