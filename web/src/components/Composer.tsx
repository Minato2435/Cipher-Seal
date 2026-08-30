import { type FormEvent, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api, ApiError } from "../lib/api";
import { fingerprint } from "../lib/format";
import type { Session } from "../lib/useSessions";
import { ReAuthModal } from "./ReAuthModal";
import {
  type StripData,
  type StripPhase,
  TransformationStrip,
} from "./TransformationStrip";

const EMPTY: StripData = { plaintext: "", sessionFp: "", ctB64: "", sigBytes: 0 };

export function Composer({
  activeSession,
  peerUid,
  peerName,
  blocked = false,
  onSessionStarted,
}: {
  activeSession: Session | null;
  peerUid: string;
  peerName: string;
  blocked?: boolean;
  onSessionStarted: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<StripPhase>("idle");
  const [data, setData] = useState<StripData>(EMPTY);
  const [notice, setNotice] = useState("");
  const [lockedByApi, setLockedByApi] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [opening, setOpening] = useState(false);
  const pending = useRef<string | null>(null);
  const locked = blocked || lockedByApi;

  async function openChannel() {
    setOpening(true);
    setNotice("");
    try {
      const { sessionId } = await api.establishSession(peerUid);
      onSessionStarted(sessionId);
    } catch {
      setNotice("Couldn't open a new channel. Try again.");
    } finally {
      setOpening(false);
    }
  }

  async function doSend(body: string) {
    if (!activeSession) return;
    setPhase("sending");
    setData({ ...EMPTY, plaintext: body });
    setNotice("");
    try {
      const { messageId } = await api.sendMessage(activeSession.id, body);
      const snap = await getDoc(doc(db, "messages", messageId));
      const m = snap.data() ?? {};
      const fp = activeSession.kemCtB64 ? await fingerprint(activeSession.kemCtB64) : "—";
      setData({
        plaintext: body,
        sessionFp: fp,
        ctB64: (m.ct_b64 ?? "") as string,
        sigBytes: m.sig_b64 ? atob(m.sig_b64 as string).length : 0,
      });
      setPhase("done");
      setText("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        pending.current = body;
        setReauth(true);
        setPhase("idle");
      } else if (err instanceof ApiError && err.code === "ACCOUNT_BLOCKED") {
        setLockedByApi(true);
        setPhase("idle");
      } else if (err instanceof ApiError && err.code === "SESSION_INACTIVE") {
        setNotice("This channel has closed. Open a new one to keep talking.");
        setPhase("idle");
      } else {
        setNotice("Couldn't send. Try again.");
        setPhase("error");
      }
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (body && !locked) void doSend(body);
  }

  if (locked) {
    return (
      <div className="border-t border-risk-critical/40 bg-risk-critical/10 px-6 py-3 text-[13px] text-risk-critical">
        This account is locked. An administrator can restore it.
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-4">
        <p className="text-[13px] text-faint">
          The secure channel with {peerName} is closed.
        </p>
        <button onClick={openChannel} disabled={opening} className="btn btn-primary">
          {opening ? "Running key exchange…" : "Open a new channel"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {notice && <p className="border-t border-line px-6 py-2 text-[13px] text-risk-high">{notice}</p>}

      <form onSubmit={submit} className="flex items-end gap-3 border-t border-line px-6 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder="Write a message — sealed before it leaves this device"
          className="input max-h-28 min-h-[42px] flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={phase === "sending" || !text.trim()}
          className="btn btn-primary"
        >
          send
        </button>
      </form>

      <div className="px-6 pb-3">
        <TransformationStrip phase={phase} data={data} />
      </div>

      {reauth && (
        <ReAuthModal
          onConfirmed={() => {
            setReauth(false);
            const body = pending.current;
            pending.current = null;
            if (body) void doSend(body);
          }}
          onCancel={() => {
            setReauth(false);
            pending.current = null;
            setPhase("idle");
          }}
        />
      )}
    </div>
  );
}
