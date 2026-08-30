import type { Session } from "../lib/useSessions";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";

function Row({
  session,
  meUid,
  selected,
  onSelect,
}: {
  session: Session;
  meUid: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const otherUid = session.participants.find((p) => p !== meUid) ?? "";
  const other = useUserDoc(otherUid);
  const active = session.state === "active";

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
        selected ? "bg-white" : "hover:bg-white/60"
      }`}
    >
      <span
        className={`font-display text-lg leading-none ${selected ? "text-ink" : "text-transparent"}`}
        aria-hidden
      >
        ▸
      </span>
      <span className="flex-1 truncate text-ink">{peerLabel(other, otherUid)}</span>
      <span
        title={active ? "active" : "ended"}
        className={`h-2 w-2 rounded-full ${
          active ? "bg-phosphor ring-1 ring-ink/20" : "border border-ink-soft"
        }`}
      />
    </button>
  );
}

export function SessionList({
  sessions,
  meUid,
  selectedId,
  onSelect,
}: {
  sessions: Session[];
  meUid: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <p className="px-2 text-sm text-ink-soft">
        No sessions yet. Start one from a peer's user ID.
      </p>
    );
  }
  return (
    <ul className="-mx-2">
      {sessions.map((s) => (
        <li key={s.id}>
          <Row
            session={s}
            meUid={meUid}
            selected={s.id === selectedId}
            onSelect={() => onSelect(s.id)}
          />
        </li>
      ))}
    </ul>
  );
}
