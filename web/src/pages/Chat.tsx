import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { middleTruncate } from "../lib/format";
import { useAuthUser } from "../lib/useAuthUser";
import { useRiskBand } from "../lib/useRiskBand";
import { effectiveBand, useMyStatus } from "../lib/useMyStatus";
import { useSessions } from "../lib/useSessions";
import { useMessages, type Message } from "../lib/useMessages";
import { buildThread, groupByPeer } from "../lib/conversations";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { RiskFrame } from "../components/RiskFrame";
import { RiskInstrument } from "../components/RiskInstrument";
import { ConversationList } from "../components/ConversationList";
import { StartSession } from "../components/StartSession";
import { MessageThread } from "../components/MessageThread";
import { Composer } from "../components/Composer";
import { EmptyThread } from "../components/EmptyThread";

export function Chat() {
  const { user, claims } = useAuthUser();
  const risk = useRiskBand(user?.uid);
  const status = useMyStatus(user?.uid);
  const sessions = useSessions(user?.uid);
  const allMessages = useMessages(user?.uid);

  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const band = effectiveBand(status, risk.band);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "you";

  const conversations = useMemo(
    () => (user ? groupByPeer(sessions, user.uid) : []),
    [sessions, user],
  );

  const lastByPeer = useMemo(() => {
    const m = new Map<string, Message>();
    for (const conv of conversations) {
      const ids = new Set(conv.sessions.map((s) => s.id));
      for (const msg of allMessages) if (ids.has(msg.sessionId)) m.set(conv.peerUid, msg);
    }
    return m;
  }, [conversations, allMessages]);

  const selectedConv = conversations.find((c) => c.peerUid === selectedPeer) ?? null;
  const threadItems = useMemo(
    () => (selectedConv ? buildThread(selectedConv, allMessages) : []),
    [selectedConv, allMessages],
  );
  const peerDoc = useUserDoc(selectedConv?.peerUid);
  const peerName = selectedConv ? peerLabel(peerDoc, selectedConv.peerUid) : "";

  async function copyId() {
    if (!user) return;
    await navigator.clipboard.writeText(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <RiskFrame band={band}>
      <div className="console">
        <aside className="rail">
          <div className="identity">
            <div className="name">{displayName}</div>
            <div className="email mono">{user?.email}</div>
            <button className="id-chip" onClick={copyId} title="Copy your user ID">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
                <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" />
                <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7" stroke="currentColor" />
              </svg>
              {copied ? "copied" : `id · ${middleTruncate(user?.uid ?? "", 14)}`}
            </button>
          </div>

          <StartSession onStarted={(_sid, peerUid) => setSelectedPeer(peerUid)} />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {user && (
              <ConversationList
                conversations={conversations}
                lastByPeer={lastByPeer}
                selectedPeer={selectedPeer}
                onSelect={setSelectedPeer}
              />
            )}
          </div>

          <div className="section-title mb-2 mt-4">Risk instrument</div>
          <RiskInstrument risk={risk} />

          <div className="mt-4 flex items-center justify-between pt-2">
            {claims.role === "admin" ? (
              <Link to="/admin" className="link-muted">
                Security monitor
              </Link>
            ) : (
              <span />
            )}
            <button onClick={() => signOut(auth)} className="link-muted">
              Sign out
            </button>
          </div>
        </aside>

        <section className="main">
          {selectedConv && user ? (
            <>
              <MessageThread conv={selectedConv} items={threadItems} meUid={user.uid} />
              <Composer
                activeSession={selectedConv.activeSession}
                peerUid={selectedConv.peerUid}
                peerName={peerName}
                blocked={status === "blocked"}
                onSessionStarted={() => setSelectedPeer(selectedConv.peerUid)}
              />
            </>
          ) : (
            <EmptyThread />
          )}
        </section>
      </div>
    </RiskFrame>
  );
}
