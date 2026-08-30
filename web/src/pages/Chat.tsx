import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { middleTruncate } from "../lib/format";
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
import { EmptyThread } from "../components/EmptyThread";

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
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <RiskFrame band={band}>
      <div className="lattice-ground flex h-screen">
        <aside className="flex w-[304px] shrink-0 flex-col gap-5 overflow-x-hidden border-r border-ink/15 bg-paper/60 px-5 pb-5 pt-12 backdrop-blur-[1px]">
          {/* identity */}
          <div>
            <p className="font-display text-[26px] leading-tight text-ink">{displayName}</p>
            <p className="truncate font-mono text-[11px] text-ink-soft">{user?.email}</p>
            <button
              onClick={copyId}
              className="group mt-2 flex w-full items-center gap-1.5 border border-ink/15 bg-white/70 px-2 py-1 font-mono text-[11px] text-ink-soft transition hover:border-ink/40"
              title="Copy your user ID"
            >
              <span className="text-ink-soft/70">id</span>
              <span className="flex-1 truncate text-left text-ink">
                {copied ? "copied ✓" : middleTruncate(user?.uid ?? "", 22)}
              </span>
              <span aria-hidden className="text-ink-soft/60 group-hover:text-ink">⧉</span>
            </button>
          </div>

          {/* sessions */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                sessions
              </h2>
              <StartSession onStarted={setSelectedId} />
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-t border-ink/10 pt-2">
              {user && (
                <SessionList
                  sessions={sessions}
                  meUid={user.uid}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </div>

          {/* the lit instrument */}
          <RiskInstrument risk={risk} />

          {import.meta.env.DEV && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-soft/70">
                dev · preview band
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {[...BANDS, "LIVE"].map((b) => {
                  const on = b === "LIVE" ? override === null : override === b;
                  return (
                    <button
                      key={b}
                      onClick={() => setOverride(b === "LIVE" ? null : override === b ? null : b)}
                      className={`border px-1.5 py-0.5 font-mono text-[10px] lowercase transition ${
                        on ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink/50"
                      }`}
                    >
                      {b.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* footer */}
          <div className="flex items-center justify-between border-t border-ink/10 pt-3 font-mono text-[11px]">
            {claims.role === "admin" ? (
              <Link to="/admin" className="text-ink underline decoration-dotted">
                security monitor
              </Link>
            ) : (
              <span />
            )}
            <button onClick={() => signOut(auth)} className="text-ink-soft underline decoration-dotted">
              sign out
            </button>
          </div>
        </aside>

        {/* main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <>
              <div className="min-h-0 flex-1">
                <MessageThread session={selected} messages={threadMessages} meUid={user.uid} />
              </div>
              <Composer session={selected} />
            </>
          ) : (
            <EmptyThread />
          )}
        </main>
      </div>
    </RiskFrame>
  );
}
