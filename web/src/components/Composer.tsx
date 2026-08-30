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

export function Composer({ session }: { session: Session }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<StripPhase>("idle");
  const [data, setData] = useState<StripData>(EMPTY);
  const [notice, setNotice] = useState("");
  const [locked, setLocked] = useState(false);
  const [reauth, setReauth] = useState(false);
  const pending = useRef<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function doSend(body: string) {
    setPhase("sending");
    setData({ ...EMPTY, plaintext: body });
    setNotice("");
    try {
      const { messageId } = await api.sendMessage(session.id, body);
      const snap = await getDoc(doc(db, "messages", messageId));
      const m = snap.data() ?? {};
      const fp = session.kemCtB64 ? await fingerprint(session.kemCtB64) : "—";
      setData({
        plaintext: body,
        sessionFp: fp,
        ctB64: (m.ct_b64 ?? "") as string,
        sigBytes: m.sig_b64 ? atob(m.sig_b64).length : 0,
      });
      setPhase("done");
      setText("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        pending.current = body;
        setReauth(true);
        setPhase("idle");
        return;
      }
      if (err instanceof ApiError && err.code === "ACCOUNT_BLOCKED") {
        setLocked(true);
        setPhase("idle");
        return;
      }
      if (err instanceof ApiError && err.code === "SESSION_INACTIVE") {
        setNotice("This session has ended. Start a new one to keep talking.");
        setPhase("idle");
        return;
      }
      setNotice("Couldn't send. Try again.");
      setPhase("error");
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (body && !locked) void doSend(body);
  }

  return (
    <div>
      {locked && (
        <p className="border-t border-critical/40 bg-critical/5 px-6 py-2 text-[13px] text-critical">
          This account is locked. An administrator can restore it.
        </p>
      )}
      {notice && !locked && (
        <p className="border-t border-ink-soft/30 px-6 py-2 text-[13px] text-high">{notice}</p>
      )}

      <form onSubmit={submit} className="flex items-end gap-3 border-t border-ink-soft/30 px-6 py-3">
        <textarea
          ref={areaRef}
          value={text}
          disabled={locked}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={1}
          placeholder={locked ? "sending is disabled" : "type a message…"}
          className="max-h-28 min-h-[38px] flex-1 resize-none border border-ink-soft/40 bg-white px-3 py-2 font-mono text-[13px] outline-none focus:border-ink disabled:bg-paper"
        />
        <button
          type="submit"
          disabled={locked || phase === "sending" || !text.trim()}
          className="bg-ink px-4 py-2 font-sans text-sm font-semibold text-paper disabled:opacity-40"
        >
          send
        </button>
      </form>

      <TransformationStrip phase={phase} data={data} />

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
          }}
        />
      )}
    </div>
  );
}
