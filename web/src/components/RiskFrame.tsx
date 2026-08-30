import type { ReactNode } from "react";
import { bandColor } from "../lib/format";

const WIDTH: Record<string, number> = { NORMAL: 2, ELEVATED: 3, HIGH: 4, CRITICAL: 6 };
const LABEL: Record<string, string> = {
  NORMAL: "normal",
  ELEVATED: "elevated",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * Signature element: a hairline frame around the whole app whose colour and
 * weight track the signed-in user's AI risk band. Calm grey at NORMAL; a thick
 * red at CRITICAL. The band name is engraved in the corner like an instrument
 * plate. Ambient — never interactive.
 */
export function RiskFrame({ band, children }: { band: string; children: ReactNode }) {
  const color = bandColor(band);
  const width = WIDTH[band] ?? 2;
  const loud = band === "HIGH" || band === "CRITICAL";

  return (
    <>
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          borderStyle: "solid",
          borderColor: color,
          borderWidth: width,
          boxShadow: loud ? `inset 0 0 ${band === "CRITICAL" ? 90 : 40}px ${color}22` : "none",
          transition: "border-color 1200ms ease, border-width 1200ms ease, box-shadow 1200ms ease",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed left-0 top-0 z-40"
        style={{
          borderRight: `${width}px solid ${color}`,
          borderBottom: `${width}px solid ${color}`,
          transition: "border-color 1200ms ease, border-width 1200ms ease",
        }}
      >
        <span
          className="block px-3 py-1 font-display text-lg lowercase"
          style={{ color, letterSpacing: "0.04em" }}
        >
          {LABEL[band] ?? "normal"}
        </span>
      </div>
    </>
  );
}
