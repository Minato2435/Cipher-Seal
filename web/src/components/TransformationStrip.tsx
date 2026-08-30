import { useEffect, useState } from "react";
import { groupHex, middleTruncate } from "../lib/format";

export type StripPhase = "idle" | "sending" | "done" | "error";

export interface StripData {
  plaintext: string;
  sessionFp: string;
  ctB64: string;
  sigBytes: number;
}

const NODES = [
  { key: "plain", label: "plain", color: "#8B93A8" },
  { key: "kem", label: "ML-KEM", color: "#3DD6D0" },
  { key: "aes", label: "AES-GCM", color: "#7C5CFF" },
  { key: "dsa", label: "ML-DSA", color: "#F5C451" },
];

export function TransformationStrip({ phase, data }: { phase: StripPhase; data: StripData }) {
  // 0 idle · 1 plain · 2 kem · 3 aes · 4 signed
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase === "idle") return setStage(0);
    if (phase === "sending") return setStage(1);
    if (phase === "error") return setStage(3);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return setStage(4);
    setStage(1);
    const t = [
      setTimeout(() => setStage(2), 140),
      setTimeout(() => setStage(3), 360),
      setTimeout(() => setStage(4), 620),
    ];
    return () => t.forEach(clearTimeout);
  }, [phase, data.plaintext]);

  const readout = (() => {
    if (phase === "idle") return "awaiting a message";
    if (phase === "error") return "seal rejected — message not sent";
    if (stage <= 1) return `"${middleTruncate(data.plaintext, 52)}"`;
    if (stage === 2) return `session key  ${data.sessionFp}`;
    if (stage === 3) return middleTruncate(groupHex(data.ctB64), 60) || "sealing…";
    return `✓  ${data.sigBytes}-byte signature verified`;
  })();

  return (
    <div className="glass overflow-hidden rounded-xl px-4 py-3">
      <p className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
        transformation
      </p>

      <div className="flex items-center">
        {NODES.map((n, i) => {
          const active = stage >= i + 1;
          const now = stage === i + 1;
          const isDsaErr = phase === "error" && n.key === "dsa";
          return (
            <div key={n.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full border text-[10px] transition-all duration-300"
                  style={{
                    borderColor: isDsaErr ? "#F03D5F" : active ? n.color : "#242C40",
                    color: isDsaErr ? "#F03D5F" : active ? n.color : "#5A6379",
                    background: active ? `${n.color}1f` : "transparent",
                    boxShadow: now ? `0 0 16px ${n.color}` : "none",
                  }}
                >
                  {n.key === "dsa" && stage >= 4 && !isDsaErr ? (
                    <span className="animate-seal-pop">✓</span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className="font-mono text-[9px] uppercase tracking-wider transition-colors"
                  style={{ color: active ? n.color : "#5A6379" }}
                >
                  {n.label}
                </span>
              </div>
              {i < NODES.length - 1 && (
                <span className="mx-1 h-px flex-1 self-start" style={{ marginTop: 14 }}>
                  <span
                    className="block h-px w-full origin-left transition-transform duration-300"
                    style={{
                      background: `linear-gradient(90deg, ${n.color}, ${NODES[i + 1].color})`,
                      transform: `scaleX(${stage > i + 1 ? 1 : 0})`,
                    }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p
        className="mt-3 truncate font-mono text-[11.5px]"
        style={{ color: phase === "error" ? "#F03D5F" : "#A7B0C6" }}
      >
        {readout}
      </p>
    </div>
  );
}
