import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Message } from "../lib/useMessages";

const plaintextCache = new Map<string, string>();

type State =
  | { kind: "loading" }
  | { kind: "ok"; text: string }
  | { kind: "tampered" }
  | { kind: "error" };

export function MessageBubble({ msg, mineUid }: { msg: Message; mineUid: string }) {
  const mine = msg.senderUid === mineUid;
  const [state, setState] = useState<State>(
    plaintextCache.has(msg.id)
      ? { kind: "ok", text: plaintextCache.get(msg.id)! }
      : { kind: "loading" },
  );

  useEffect(() => {
    if (plaintextCache.has(msg.id)) return;
    let live = true;
    api
      .readMessage(msg.id)
      .then(({ plaintext }) => {
        plaintextCache.set(msg.id, plaintext);
        if (live) setState({ kind: "ok", text: plaintext });
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && err.code === "SIGNATURE_INVALID")
          setState({ kind: "tampered" });
        else setState({ kind: "error" });
      });
    return () => {
      live = false;
    };
  }, [msg.id]);

  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tampered = state.kind === "tampered";

  return (
    <div className={`flex animate-rise-in ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[72%]">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
            tampered
              ? "border border-risk-high/60 bg-risk-high/10 text-risk-high"
              : mine
                ? "text-text"
                : "glass text-text"
          } ${mine && !tampered ? "rounded-br-md" : ""} ${!mine && !tampered ? "rounded-bl-md" : ""}`}
          style={
            mine && !tampered
              ? {
                  background:
                    "linear-gradient(135deg, rgba(124,92,255,.18), rgba(61,214,208,.12))",
                  border: "1px solid rgba(124,92,255,.35)",
                }
              : undefined
          }
        >
          {state.kind === "loading" && (
            <span className="font-mono text-muted">
              <span className="inline-block animate-pulse">decrypting…</span>
            </span>
          )}
          {state.kind === "ok" && state.text}
          {tampered && "⚠ signature check failed — message rejected"}
          {state.kind === "error" && (
            <span className="font-mono text-muted">couldn't open this message</span>
          )}
        </div>
        <p
          className={`mt-1 flex items-center gap-1.5 font-mono text-[10px] text-faint ${
            mine ? "justify-end" : "justify-start"
          }`}
        >
          {time}
          {msg.verified === true && state.kind === "ok" && (
            <span className="text-quantum font-semibold">✓ verified</span>
          )}
        </p>
      </div>
    </div>
  );
}
