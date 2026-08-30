import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface Message {
  id: string;
  sessionId: string;
  senderUid: string;
  recipientUid: string;
  ct_b64: string;
  iv_b64: string;
  tag_b64: string;
  sig_b64: string;
  sigAlg: string;
  verified: boolean | null;
  createdAt: number;
}

/** Every message the user is a party to, oldest first. Filter by session in the view. */
export function useMessages(uid: string | undefined): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!uid) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", uid),
      orderBy("createdAt"),
    );
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            sessionId: v.sessionId,
            senderUid: v.senderUid,
            recipientUid: v.recipientUid,
            ct_b64: v.ct_b64 ?? "",
            iv_b64: v.iv_b64 ?? "",
            tag_b64: v.tag_b64 ?? "",
            sig_b64: v.sig_b64 ?? "",
            sigAlg: v.sigAlg ?? "",
            verified: v.verified ?? null,
            createdAt: v.createdAt?.toMillis?.() ?? Date.now(),
          } as Message;
        }),
      );
    });
  }, [uid]);

  return messages;
}
