import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Live account status from the user's own users/{uid} doc (rules allow self-read). */
export function useMyStatus(uid: string | undefined): string {
  const [status, setStatus] = useState("normal");

  useEffect(() => {
    if (!uid) {
      setStatus("normal");
      return;
    }
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => setStatus((snap.data()?.status as string) ?? "normal"),
      () => setStatus("normal"),
    );
  }, [uid]);

  return status;
}

/** The band the chrome should show: enforcement status wins when it's more severe. */
export function effectiveBand(status: string, riskBand: string): string {
  const fromStatus: Record<string, string> = {
    blocked: "CRITICAL",
    high: "HIGH",
    elevated: "ELEVATED",
  };
  const s = fromStatus[status];
  if (!s) return riskBand;
  const order = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"];
  return order.indexOf(s) >= order.indexOf(riskBand) ? s : riskBand;
}
