import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { middleTruncate } from "../lib/format";
import { useAuthUser } from "../lib/useAuthUser";
import { useRiskBand } from "../lib/useRiskBand";
import { effectiveBand, useMyStatus } from "../lib/useMyStatus";
import { useSessions } from "../lib/useSessions";
import { useMessages } from "../lib/useMessages";
import { buildThread, groupByPeer } from "../lib/conversations";
import { peerLabel, useUserDoc } from "../lib/useUserDoc";
import { RiskFrame } from "../components/RiskFrame";
import { RiskInstrument } from "../components/RiskInstrument";
import { ConversationList } from "../components/ConversationList";
import { StartSession } from "../components/StartSession";
import { MessageThread } from "../components/MessageThread";
import { Composer } from "../components/Composer";
import { EmptyThread } from "../components/EmptyThread";
import { Avatar } from "../components/Avatar";

const BANDS = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"];

export function Chat() {
  const { user, claims } = useAuthUser();
  const risk = useRiskBand(user?.uid);
  const status = useMyStatus(user?.uid);
  const sessions = useSessions(user?.uid);
  const allMessages = useMessages(user?.uid);

  const [override, setOverride] = useState<string | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const band = override ?? effectiveBand(status, risk.band);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "you";

  const conversations = useMemo(
    () => (user ? groupByPeer(sessions, user.uid).filter((c) => !hidden.has(c.peerUid)) : []),
    [sessions, user, hidden],
  );
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
      <div className="flex h-[calc(100vh-0px)] min-h-[560px]">
        <aside className="flex w-[304px] shrink-0 flex-col gap-4 border-r border-line px-4 pb-4 pt-14">
          {/* identity */}
          <div className="flex items-center gap-3">
            <Avatar uid={user?.uid ?? ""} name={displayName} size={40} />
            <div className="min-w-0">
              <p className="truncate font-display text-[17px] font-semibold text-text">
                {displayName}
              </p>
              <p className="truncate font-mono text-[10.5px] text-faint">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={copyId}
            className="glass -mt-1 flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 font-mono text-[10.5px] text-muted transition hover:text-text"
            title="Copy your user ID"
          >
            <span className="text-faint">id</span>
            <span className="text-text">
              {copied ? "copied ✓" : middleTruncate(user?.uid ?? "", 18)}
            </span>
            <span aria-hidden>⧉</span>
          </button>

          {/* conversations */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between pb-1">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                conversations
              </h2>
              <StartSession
                onStarted={(_sid, peerUid) => {
                  setHidden((h) => {
                    const n = new Set(h);
                    n.delete(peerUid);
                    return n;
                  });
                  setSelectedPeer(peerUid);
                }}
              />
            </div>
            <div className="mt-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <ConversationList
                conversations={conversations}
                selectedPeer={selectedPeer}
                onSelect={setSelectedPeer}
              />
            </div>
          </div>

          <RiskInstrument risk={risk} />

          {import.meta.env.DEV && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                dev · preview band
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {[...BANDS, "LIVE"].map((b) => {
                  const on = b === "LIVE" ? override === null : override === b;
                  return (
                    <button
                      key={b}
                      onClick={() => setOverride(b === "LIVE" ? null : override === b ? null : b)}
                      className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] lowercase transition ${
                        on
                          ? "border-violet bg-violet/20 text-text"
                          : "border-line text-muted hover:border-violet/50"
                      }`}
                    >
                      {b.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[11px]">
            {claims.role === "admin" ? (
              <Link to="/admin" className="text-quantum font-semibold">
                security monitor →
              </Link>
            ) : (
              <span />
            )}
            <button onClick={() => signOut(auth)} className="text-faint hover:text-text">
              sign out
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {selectedConv && user ? (
            <>
              <div className="flex items-center justify-end px-6 pt-3">
                <button
                  onClick={() => {
                    setHidden((h) => new Set(h).add(selectedConv.peerUid));
                    setSelectedPeer(null);
                  }}
                  className="font-mono text-[10.5px] text-faint hover:text-risk-high"
                  title="Hide this conversation from your list (local only)"
                >
                  clear from view
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <MessageThread conv={selectedConv} items={threadItems} meUid={user.uid} />
              </div>
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
        </main>
      </div>
    </RiskFrame>
  );
}
