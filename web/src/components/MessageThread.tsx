import { useEffect, useRef } from "react";
import type { Message } from "../lib/useMessages";
import type { Session } from "../lib/useSessions";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { MessageBubble } from "./MessageBubble";

export function MessageThread({
  session,
  messages,
  meUid,
}: {
  session: Session;
  messages: Message[];
  meUid: string;
}) {
  const otherUid = session.participants.find((p) => p !== meUid) ?? "";
  const other = useUserDoc(otherUid);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline gap-3 border-b border-ink-soft/30 px-6 py-3">
        <h2 className="font-display text-2xl text-ink">{peerLabel(other, otherUid)}</h2>
        {session.state === "terminated" && (
          <span className="font-mono text-[11px] text-ink-soft">session ended</span>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink-soft">
            No messages yet. Anything you send is sealed with ML-KEM before it leaves this session.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} mineUid={meUid} />)
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
