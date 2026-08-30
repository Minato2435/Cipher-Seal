import { useEffect, useRef } from "react";
import type { Conversation, ThreadItem } from "../lib/conversations";
import type { Message } from "../lib/useMessages";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";

export function MessageThread({
  conv,
  items,
  meUid,
}: {
  conv: Conversation;
  items: ThreadItem[];
  meUid: string;
}) {
  const peer = useUserDoc(conv.peerUid);
  const name = peerLabel(peer, conv.peerUid);
  const bottom = useRef<HTMLDivElement>(null);
  const msgCount = items.filter((i) => i.kind === "message").length;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCount]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-6 py-3">
        <Avatar uid={conv.peerUid} name={name} size={30} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold text-text">{name}</h2>
          <p className="text-[11px] text-faint">
            {conv.activeSession ? "secure channel open" : "no open channel — start a new one"}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {items.length === 0 ? (
          <p className="mx-auto mt-10 max-w-sm text-center text-[13px] leading-relaxed text-faint">
            No messages yet. Anything you send is sealed with ML-KEM before it leaves this device.
          </p>
        ) : (
          items.map((item, i) =>
            item.kind === "divider" ? (
              <div key={`d-${i}`} className="flex items-center gap-3 py-2">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  new secure session
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : (
              <MessageBubble key={(item.msg as Message).id} msg={item.msg} mineUid={meUid} />
            ),
          )
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
