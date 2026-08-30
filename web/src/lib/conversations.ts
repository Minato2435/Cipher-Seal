import type { Message } from "./useMessages";
import type { Session } from "./useSessions";

export interface Conversation {
  peerUid: string;
  sessions: Session[]; // newest first
  activeSession: Session | null;
  lastActivity: number;
}

/** Group a user's sessions by the other participant. */
export function groupByPeer(sessions: Session[], meUid: string): Conversation[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const peer = s.participants.find((p) => p !== meUid);
    if (!peer) continue;
    const list = map.get(peer) ?? [];
    list.push(s);
    map.set(peer, list);
  }
  const out: Conversation[] = [];
  for (const [peerUid, list] of map) {
    list.sort((a, b) => b.createdAt - a.createdAt);
    out.push({
      peerUid,
      sessions: list,
      activeSession: list.find((s) => s.state === "active") ?? null,
      lastActivity: list[0]?.createdAt ?? 0,
    });
  }
  out.sort((a, b) => b.lastActivity - a.lastActivity);
  return out;
}

export type ThreadItem =
  | { kind: "message"; msg: Message }
  | { kind: "divider"; sessionId: string; index: number; startedAt: number };

/** All messages across a conversation's sessions, time-ordered, with a divider
 *  wherever the session (and therefore the keys) changed. */
export function buildThread(conv: Conversation, allMessages: Message[]): ThreadItem[] {
  const ids = new Set(conv.sessions.map((s) => s.id));
  const startedAt = new Map(conv.sessions.map((s) => [s.id, s.createdAt]));
  const msgs = allMessages
    .filter((m) => ids.has(m.sessionId))
    .sort((a, b) => a.createdAt - b.createdAt);

  const items: ThreadItem[] = [];
  let currentSession: string | null = null;
  let sessionCount = 0;
  for (const msg of msgs) {
    if (msg.sessionId !== currentSession) {
      currentSession = msg.sessionId;
      sessionCount += 1;
      if (sessionCount > 1) {
        items.push({
          kind: "divider",
          sessionId: msg.sessionId,
          index: sessionCount,
          startedAt: startedAt.get(msg.sessionId) ?? msg.createdAt,
        });
      }
    }
    items.push({ kind: "message", msg });
  }
  return items;
}

/** Deterministic gradient avatar from a uid. */
export function avatarGradient(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 60 + ((h >> 8) % 120)) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 60%), hsl(${b} 65% 52%))`;
}
