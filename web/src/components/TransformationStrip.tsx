import { useEffect, useState } from "react";
import { groupHex, middleTruncate } from "../lib/format";

export type StripPhase = "idle" | "sending" | "done" | "error";

export interface StripData {
  plaintext: string;
  sessionFp: string;
  ctB64: string;
  sigBytes: number;
}

const SCRAMBLE = "▚▞▚▞▞▚▞▚";

function Row({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-[3px]">
      <span
        className={`w-16 shrink-0 text-right text-[10px] uppercase tracking-[0.14em] ${
          active ? "text-phosphor/70" : "text-ink-soft/50"
        }`}
      >
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${active ? "text-phosphor" : "text-ink-soft/40"}`}
      >
        {children}
      </span>
    </div>
  );
}

/** Signature element: the lit instrument. Plays plaintext → ML-KEM → AES-GCM → ML-DSA. */
export function TransformationStrip({
  phase,
  data,
}: {
  phase: StripPhase;
  data: StripData;
}) {
  // stage 0 nothing · 1 plaintext · 2 +kem · 3 +aes · 4 +signed
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase === "idle") {
      setStage(0);
      return;
    }
    if (phase === "sending") {
      setStage(1);
      return;
    }
    if (phase === "error") {
      setStage(3);
      return;
    }
    // done → advance 1→4
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStage(4);
      return;
    }
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 130);
    const t2 = setTimeout(() => setStage(3), 320);
    const t3 = setTimeout(() => setStage(4), 560);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [phase, data.plaintext]);

  const idle = phase === "idle";

  return (
    <div className="border-t border-ink-soft/30 bg-instrument px-4 py-3 font-mono text-[12px]">
      <p className="mb-1 text-[9px] uppercase tracking-[0.24em] text-ink-soft/60">transformation</p>

      <Row label="plain" active={stage >= 1}>
        {idle ? "—" : stage >= 1 ? `"${data.plaintext}"` : "—"}
      </Row>

      <Row label="ML-KEM" active={stage >= 2}>
        {stage < 2 ? (idle ? "—" : "deriving session key…") : stage === 2 ? SCRAMBLE : data.sessionFp}
      </Row>

      <Row label="AES-GCM" active={stage >= 3}>
        {stage < 3
          ? idle
            ? "—"
            : "sealing…"
          : middleTruncate(groupHex(data.ctB64), 46)}
      </Row>

      <Row label="ML-DSA" active={stage >= 3}>
        {phase === "error" ? (
          <span className="text-high">seal rejected</span>
        ) : stage < 4 ? (
          stage === 3 ? (
            <span
              className="inline-block h-[3px] w-full bg-phosphor/70"
              style={{ animation: "wipe 220ms ease-out both" }}
            />
          ) : idle ? (
            "—"
          ) : (
            "signing…"
          )
        ) : (
          <span>
            <span
              className="mr-1.5 inline-block"
              style={{ animation: "seal-pop 260ms ease-out both" }}
            >
              ✓
            </span>
            {data.sigBytes}-byte seal
          </span>
        )}
      </Row>
    </div>
  );
}
