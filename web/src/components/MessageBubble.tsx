import type { Message } from "../lib/useMessages";
import { usePlaintext } from "../lib/plaintext";

export function MessageBubble({ msg, mineUid }: { msg: Message; mineUid: string }) {
  const mine = msg.senderUid === mineUid;
  const state = usePlaintext(msg.id);
  const tampered = state.kind === "tampered";

  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`msg-row ${mine ? "mine" : "theirs"} ${tampered ? "tampered" : ""}`}>
      <div className="msg">
        <div className="msg-body">
          {state.kind === "loading" && <span className="mono opacity-50">·····</span>}
          {state.kind === "ok" && state.text}
          {tampered && "This message failed its signature check and was rejected."}
          {state.kind === "error" && <span className="opacity-60">Couldn't open this message</span>}
        </div>
        {!tampered && (
          <div className="msg-foot">
            <span>{time}</span>
            {msg.verified === true && state.kind === "ok" && (
              <span className="verified">✓ verified</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
