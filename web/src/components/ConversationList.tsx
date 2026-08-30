import type { Conversation } from "../lib/conversations";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { Avatar } from "./Avatar";

function Row({
  conv,
  selected,
  onSelect,
}: {
  conv: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const peer = useUserDoc(conv.peerUid);
  const name = peerLabel(peer, conv.peerUid);
  const live = !!conv.activeSession;

  return (
    <button
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
        selected ? "bg-white/[.06]" : "hover:bg-white/[.035]"
      }`}
    >
      <span
        className="absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-full transition-all"
        style={{
          width: selected ? 3 : 0,
          background: "linear-gradient(#7C5CFF,#3DD6D0)",
          boxShadow: selected ? "0 0 10px rgba(124,92,255,.7)" : "none",
        }}
      />
      <Avatar uid={conv.peerUid} name={name} ring={selected} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-text">{name}</span>
        <span className="block truncate text-[11.5px] text-faint">
          {live ? "secure channel open" : "channel closed"}
          {conv.sessions.length > 1 ? ` · ${conv.sessions.length} sessions` : ""}
        </span>
      </span>
      {live && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan"
          style={{ boxShadow: "0 0 8px #3DD6D0" }}
        />
      )}
    </button>
  );
}

export function ConversationList({
  conversations,
  selectedPeer,
  onSelect,
}: {
  conversations: Conversation[];
  selectedPeer: string | null;
  onSelect: (peerUid: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 text-[13px] leading-relaxed text-faint">
        No conversations yet. Start one with a peer's user ID.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5">
      {conversations.map((c) => (
        <li key={c.peerUid}>
          <Row conv={c} selected={c.peerUid === selectedPeer} onSelect={() => onSelect(c.peerUid)} />
        </li>
      ))}
    </ul>
  );
}
