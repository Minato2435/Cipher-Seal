import { useEffect, useRef } from "react";
import type { Conversation, ThreadItem } from "../lib/conversations";
import type { Message } from "../lib/useMessages";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { MessageBubble } from "./MessageBubble";

export function MessageThread({
  conv,
  items,
  meUid,
  onClear,
}: {
  conv: Conversation;
  items: ThreadItem[];
  meUid: string;
  onClear: () => void;
}) {
  const peer = useUserDoc(conv.peerUid);
  const name = peerLabel(peer, conv.peerUid);
  const bottom = useRef<HTMLDivElement>(null);
  const count = items.filter((i) => i.kind === "message").length;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [count]);

  return (
    <>
      <div className="main-header">
        <h2>{name}</h2>
        <span className="mono text-[11px] text-[color:var(--n-500)]">
          {conv.activeSession ? "sealed correspondence" : "session ended"}
        </span>
        <button
          onClick={onClear}
          className="link-muted ml-auto !text-[11.5px]"
          title="Hide this correspondence from your list (local only)"
        >
          hide
        </button>
      </div>

      <div className="thread-wrap">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="plate empty-caption">
              No letters yet. Anything you send is sealed with ML-KEM before it leaves this device.
            </div>
          </div>
        ) : (
          items.map((item, i) =>
            item.kind === "divider" ? (
              <div key={`d-${i}`} className="session-divider">
                <span className="rule" />
                <span className="wax" aria-hidden />
                fresh seal
                {item.startedAt
                  ? ` · ${new Date(item.startedAt).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""}
                <span className="rule" />
              </div>
            ) : (
              <MessageBubble key={(item.msg as Message).id} msg={item.msg} mineUid={meUid} />
            ),
          )
        )}
        <div ref={bottom} />
      </div>
    </>
  );
}
