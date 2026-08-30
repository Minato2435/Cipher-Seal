import type { ReactNode } from "react";
import { bandColor } from "../lib/format";

const WIDTH: Record<string, number> = { NORMAL: 2, ELEVATED: 3, HIGH: 5, CRITICAL: 7 };
const LABEL: Record<string, string> = {
  NORMAL: "normal",
  ELEVATED: "elevated",
  HIGH: "high",
  CRITICAL: "critical",
};

/**
 * Signature element: a hairline frame around the whole app whose colour and
 * weight track the signed-in user's AI risk band. Calm grey at NORMAL; a thick
 * red at CRITICAL. The band name sits on an engraved corner plate. Ambient.
 */
export function RiskFrame({ band, children }: { band: string; children: ReactNode }) {
  const color = bandColor(band);
  const width = WIDTH[band] ?? 2;
  const loud = band === "HIGH" || band === "CRITICAL";
  const ease = "1100ms cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <>
      {children}

      {/* the frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          borderStyle: "solid",
          borderColor: color,
          borderWidth: width,
          boxShadow: loud
            ? `inset 0 0 ${band === "CRITICAL" ? 120 : 50}px ${color}1f`
            : "none",
          transition: `border-color ${ease}, border-width ${ease}, box-shadow ${ease}`,
        }}
      />

      {/* engraved corner plate — opaque so it never collides with page content */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed left-0 top-0 z-50 flex items-center gap-2 px-3 py-1"
        style={{ background: color, transition: `background ${ease}` }}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5"
          style={{ background: "#EDF0F3", opacity: 0.85 }}
        />
        <span className="font-display text-[15px] lowercase leading-none text-paper" style={{ letterSpacing: "0.05em" }}>
          {LABEL[band] ?? "normal"}
        </span>
      </div>
    </>
  );
}
