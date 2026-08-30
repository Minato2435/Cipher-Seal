import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuthUser } from "../lib/useAuthUser";
import { useRiskBand } from "../lib/useRiskBand";
import { useSessions } from "../lib/useSessions";
import { useMessages } from "../lib/useMessages";
import { RiskFrame } from "../components/RiskFrame";
import { RiskInstrument } from "../components/RiskInstrument";
import { SessionList } from "../components/SessionList";
import { StartSession } from "../components/StartSession";
import { MessageThread } from "../components/MessageThread";
import { Composer } from "../components/Composer";

const BANDS = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"];

export function Chat() {
  const { user, claims } = useAuthUser();
  const risk = useRiskBand(user?.uid);
  const sessions = useSessions(user?.uid);
  const allMessages = useMessages(user?.uid);

  const [override, setOverride] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const band = override ?? risk.band;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "you";
  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const threadMessages = useMemo(
    () => allMessages.filter((m) => m.sessionId === selectedId),
    [allMessages, selectedId],
  );

  async function copyId() {
    if (!user) return;
    await navigator.clipboard.writeText(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <RiskFrame band={band}>
      <div className="lattice-ground flex h-screen">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-ink-soft/30 bg-paper/70 px-5 py-6">
          <div>
            <p className="font-display text-2xl leading-tight text-ink">{displayName}</p>
            <p className="truncate font-mono text-[11px] text-ink-soft">{user?.email}</p>
            <button
              onClick={copyId}
              className="mt-1 block max-w-full truncate font-mono text-[11px] text-ink-soft underline decoration-dotted"
              title="Copy your user ID"
            >
              your id: {copied ? "copied ✓" : user?.uid}
            </button>
          </div>

          <div className="mt-5">
            <StartSession onStarted={setSelectedId} />
          </div>

          <div className="mt-4 flex-1 overflow-y-auto border-t border-ink-soft/30 pt-3">
            {user && (
              <SessionList
                sessions={sessions}
                meUid={user.uid}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>

          <div className="mt-3 border-t border-ink-soft/30 pt-3">
            <RiskInstrument risk={risk} />
          </div>

          {import.meta.env.DEV && (
            <div className="mt-3 border-t border-dashed border-ink-soft/40 pt-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                dev · preview band
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {BANDS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setOverride(b === band ? null : b)}
                    className="border border-ink-soft/50 px-1.5 py-0.5 font-mono text-[10px] hover:bg-white"
                  >
                    {b.toLowerCase()}
                  </button>
                ))}
                <button
                  onClick={() => setOverride(null)}
                  className="border border-ink-soft/50 px-1.5 py-0.5 font-mono text-[10px] hover:bg-white"
                >
                  live
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-ink-soft/30 pt-3 font-mono text-[11px]">
            {claims.role === "admin" ? (
              <Link to="/admin" className="underline">
                security monitor
              </Link>
            ) : (
              <span />
            )}
            <button onClick={() => signOut(auth)} className="text-ink-soft underline">
              sign out
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <>
              <div className="min-h-0 flex-1">
                <MessageThread session={selected} messages={threadMessages} meUid={user.uid} />
              </div>
              <Composer session={selected} />
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-8">
              <p className="font-display text-3xl text-ink-soft">Pick a session, or start one.</p>
            </div>
          )}
        </main>
      </div>
    </RiskFrame>
  );
}
