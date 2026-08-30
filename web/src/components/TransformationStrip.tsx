import { Fragment, useEffect, useRef, useState } from "react";
import { groupHex, middleTruncate } from "../lib/format";

export type StripPhase = "idle" | "sending" | "done" | "error";

export interface StripData {
  plaintext: string;
  sessionFp: string;
  ctB64: string;
  sigBytes: number;
}

const STAGES: { key: string; label: string }[] = [
  { key: "plain", label: "plain" },
  { key: "kem", label: "ML-KEM" },
  { key: "aes", label: "AES-GCM" },
  { key: "dsa", label: "ML-DSA" },
];
const order = (k: string) => STAGES.findIndex((s) => s.key === k);

function randomHex(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function TransformationStrip({ phase, data }: { phase: StripPhase; data: StripData }) {
  const [now, setNow] = useState<string>(""); // active stage key
  const [readout, setReadout] = useState("awaiting a message");
  const [pop, setPop] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPop(false);

    if (phase === "idle") {
      setNow("");
      setReadout("awaiting a message");
      return;
    }
    if (phase === "error") {
      setNow("dsa");
      setReadout("seal rejected — letter not sent");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = reduced ? [0, 0, 0, 0] : [0, 175, 375, 600];

    timers.current.push(
      window.setTimeout(() => {
        setNow("plain");
        setReadout(`"${middleTruncate(data.plaintext, 40)}"`);
      }, t[0]),
    );
    timers.current.push(
      window.setTimeout(() => {
        setNow("kem");
        let ticks = 0;
        const iv = window.setInterval(() => {
          setReadout(randomHex(16));
          if (++ticks > 5 || reduced) {
            clearInterval(iv);
            setReadout(data.sessionFp || randomHex(16));
          }
        }, 28);
        timers.current.push(iv);
      }, t[1]),
    );
    timers.current.push(
      window.setTimeout(() => {
        setNow("aes");
        setReadout(
          data.ctB64 ? middleTruncate(groupHex(data.ctB64), 52) : randomHex(48).match(/.{1,4}/g)!.join(" "),
        );
      }, t[2]),
    );
    timers.current.push(
      window.setTimeout(() => {
        setNow("dsa");
        setReadout("SEAL");
        setPop(true);
      }, t[3]),
    );

    return () => timers.current.forEach(clearTimeout);
  }, [phase, data.plaintext]);

  // when the real result lands, lock the final seal readout
  useEffect(() => {
    if (phase === "done" && data.sigBytes) {
      setNow("dsa");
      setReadout("SEAL");
      setPop(true);
    }
  }, [phase, data.sigBytes]);

  return (
    <div className="strip">
      <div className="strip-title">
        <span>Transformation</span>
        <span>{phase === "idle" ? "idle" : phase === "sending" ? "sealing…" : phase}</span>
      </div>
      <div className="strip-stages">
        {STAGES.map((s, i) => {
          const cls =
            now === s.key ? "strip-stage now" : now && order(s.key) < order(now) ? "strip-stage done" : "strip-stage";
          return (
            <Fragment key={s.key}>
              <span className={cls}>{s.label}</span>
              {i < STAGES.length - 1 && <span className="strip-arrow">→</span>}
            </Fragment>
          );
        })}
      </div>
      <div className="strip-readout">
        {readout === "SEAL" ? (
          <span className={`seal${pop ? " pop" : ""}`}>✓ {data.sigBytes || "—"}-byte seal</span>
        ) : (
          readout
        )}
      </div>
    </div>
  );
}
