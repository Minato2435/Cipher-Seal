import type { Conversation } from "../lib/conversations";
import type { Message } from "../lib/useMessages";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";

function Row({
  conv,
  lastMsg,
  selected,
  onSelect,
}: {
  conv: Conversation;
  lastMsg: Message | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const peer = useUserDoc(conv.peerUid);
  const name = peerLabel(peer, conv.peerUid);
  const live = !!conv.activeSession;
  const time = lastMsg
    ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <button
      onClick={onSelect}
      className={`session-row${selected ? " selected" : ""}`}
      aria-current={selected}
    >
      <span className="session-marker">▸</span>
      <span className={`session-dot ${live ? "active" : "ended"}`} />
      <span className="session-name">
        <span className="who flex items-baseline justify-between gap-2">
          <span className="truncate">{name}</span>
          {time && <span className="mono shrink-0 text-[10px] text-[color:var(--n-500)]">{time}</span>}
        </span>
        <span className="sub block truncate">
          {live ? "sealed · channel open" : "channel closed"}
          {conv.sessions.length > 1 ? ` · ${conv.sessions.length} sessions` : ""}
        </span>
      </span>
    </button>
  );
}

export function ConversationList({
  conversations,
  lastByPeer,
  selectedPeer,
  onSelect,
}: {
  conversations: Conversation[];
  lastByPeer: Map<string, Message>;
  selectedPeer: string | null;
  onSelect: (peerUid: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="px-1 py-4 text-[12.5px] leading-relaxed text-[color:var(--n-500)]">
        No correspondents yet. Use the + above to begin one with a peer's user ID.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((c) => (
        <Row
          key={c.peerUid}
          conv={c}
          lastMsg={lastByPeer.get(c.peerUid)}
          selected={c.peerUid === selectedPeer}
          onSelect={() => onSelect(c.peerUid)}
        />
      ))}
    </div>
  );
}
