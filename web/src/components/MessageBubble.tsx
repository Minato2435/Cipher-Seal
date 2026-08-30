import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Message } from "../lib/useMessages";

// one shared plaintext cache so re-renders don't re-call read_message
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

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[68%]">
        <div
          className={`px-3 py-2 text-[14px] leading-snug ${
            state.kind === "tampered"
              ? "border border-high text-high"
              : mine
                ? "bg-instrument/5 text-ink"
                : "bg-white text-ink"
          }`}
        >
          {state.kind === "loading" && <span className="font-mono text-ink-soft">···</span>}
          {state.kind === "ok" && state.text}
          {state.kind === "tampered" && "⚠ signature check failed — message rejected"}
          {state.kind === "error" && (
            <span className="font-mono text-ink-soft">couldn't open this message</span>
          )}
        </div>
        <p
          className={`mt-1 font-mono text-[10px] text-ink-soft ${mine ? "text-right" : "text-left"}`}
        >
          {time}
          {msg.verified === true && state.kind === "ok" && (
            <span className="ml-1.5 text-ink">✓ verified</span>
          )}
        </p>
      </div>
    </div>
  );
}
