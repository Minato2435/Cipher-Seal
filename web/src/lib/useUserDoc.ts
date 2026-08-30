import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface UserDoc {
  displayName?: string;
  email?: string;
  role?: string;
  status?: string;
}

const cache = new Map<string, UserDoc>();

/** Read-through cache of users/{uid} (own doc, or a peer you share a session with). */
export function useUserDoc(uid: string | undefined): UserDoc | undefined {
  const [d, setD] = useState<UserDoc | undefined>(uid ? cache.get(uid) : undefined);

  useEffect(() => {
    if (!uid) return;
    if (cache.has(uid)) {
      setD(cache.get(uid));
      return;
    }
    let live = true;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        const v = (snap.data() ?? {}) as UserDoc;
        cache.set(uid, v);
        if (live) setD(v);
      })
      .catch(() => {
        if (live) setD({});
      });
    return () => {
      live = false;
    };
  }, [uid]);

  return d;
}

export function peerLabel(u: UserDoc | undefined, uid: string): string {
  return u?.displayName || u?.email?.split("@")[0] || `${uid.slice(0, 6)}…`;
}
