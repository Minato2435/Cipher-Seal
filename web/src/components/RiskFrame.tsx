import { type ReactNode, useEffect } from "react";

const CFG: Record<string, { key: string; label: string; width: string }> = {
  NORMAL: { key: "calm", label: "Calm", width: "1px" },
  ELEVATED: { key: "elevated", label: "Elevated", width: "2px" },
  HIGH: { key: "high", label: "High", width: "3px" },
  CRITICAL: { key: "critical", label: "Critical", width: "5px" },
};

/** The whole app lives in one centred, framed card. Its border and a soft wax
 *  halo take the colour and weight of the signed-in user's risk band. */
export function RiskFrame({ band, children }: { band: string; children: ReactNode }) {
  const c = CFG[band] ?? CFG.NORMAL;

  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--risk-color", `var(--risk-${c.key})`);
    s.setProperty("--risk-soft", `var(--risk-${c.key}-soft)`);
    s.setProperty("--risk-width", c.width);
    return () => {
      s.setProperty("--risk-color", "var(--risk-calm)");
      s.setProperty("--risk-soft", "var(--risk-calm-soft)");
      s.setProperty("--risk-width", "1px");
    };
  }, [c.key, c.width]);

  return (
    <div className="frame-outer">
      <div className="risk-frame">
        <div className="risk-plate" role="status" aria-live="polite">
          {c.label}
        </div>
        {children}
      </div>
    </div>
  );
}
