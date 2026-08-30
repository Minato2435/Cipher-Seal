import { type ReactNode, useEffect } from "react";

type Cfg = {
  label: string;
  color: string;
  soft: string;
  glow: string;
  border: number;
  gradient: string;
  drift: boolean;
  pulse: boolean;
};

const CFG: Record<string, Cfg> = {
  NORMAL: {
    label: "calm",
    color: "#5B6478",
    soft: "rgba(124,92,255,.18)",
    glow: "rgba(124,92,255,.16)",
    border: 2,
    gradient: "linear-gradient(120deg,#7C5CFF,#3DD6D0,#7C5CFF)",
    drift: true,
    pulse: false,
  },
  ELEVATED: {
    label: "elevated",
    color: "#F2A93B",
    soft: "rgba(242,169,59,.22)",
    glow: "rgba(242,169,59,.28)",
    border: 3,
    gradient: "linear-gradient(120deg,#F2A93B,#F5C451,#F2A93B)",
    drift: true,
    pulse: false,
  },
  HIGH: {
    label: "high",
    color: "#F26430",
    soft: "rgba(242,100,48,.26)",
    glow: "rgba(242,100,48,.4)",
    border: 4,
    gradient: "linear-gradient(120deg,#F26430,#F03D5F,#F26430)",
    drift: true,
    pulse: true,
  },
  CRITICAL: {
    label: "critical",
    color: "#F03D5F",
    soft: "rgba(240,61,95,.3)",
    glow: "rgba(240,61,95,.55)",
    border: 6,
    gradient: "linear-gradient(120deg,#F03D5F,#FF6B8A,#F03D5F)",
    drift: true,
    pulse: true,
  },
};

/**
 * Signature element. A living gradient frame around the whole app: a violet↔cyan
 * aurora drift when calm, locking to the risk hue and pulsing as the band rises,
 * with a matching glow and a corner plate.
 */
export function RiskFrame({ band, children }: { band: string; children: ReactNode }) {
  const c = CFG[band] ?? CFG.NORMAL;

  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--risk", c.color);
    s.setProperty("--risk-soft", c.soft);
    s.setProperty("--risk-glow", c.glow);
  }, [c.color, c.soft, c.glow]);

  return (
    <>
      {children}

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 rounded-[14px]"
        style={{
          padding: c.border,
          background: c.gradient,
          backgroundSize: "300% 300%",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: c.drift ? "aurora-drift 9s ease-in-out infinite" : undefined,
          transition: "padding 1s ease",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: `inset 0 0 ${c.pulse ? 120 : 70}px ${c.glow}`,
          transition: "box-shadow 1s ease",
          animation: c.pulse ? "aurora-drift 4s ease-in-out infinite" : undefined,
        }}
      />

      <div
        role="status"
        aria-live="polite"
        className="glass pointer-events-none fixed left-4 top-4 z-50 flex items-center gap-2 rounded-full px-3 py-1"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}
        />
        <span className="font-display text-[12px] font-semibold lowercase tracking-wide text-text">
          {c.label}
        </span>
      </div>
    </>
  );
}
