import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface Session {
  id: string;
  participants: string[];
  state: "active" | "terminated";
  createdAt: number;
  kemCtB64: string;
}

/** Live list of sessions the user takes part in, newest first. */
export function useSessions(uid: string | undefined): Session[] {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      return;
    }
    const q = query(collection(db, "sessions"), where("participants", "array-contains", uid));
    return onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          participants: (v.participants ?? []) as string[],
          state: (v.state ?? "active") as Session["state"],
          createdAt: v.createdAt?.toMillis?.() ?? 0,
          kemCtB64: (v.kemCtB64 ?? "") as string,
        };
      });
      rows.sort((a, b) => b.createdAt - a.createdAt);
      setSessions(rows);
    });
  }, [uid]);

  return sessions;
}
