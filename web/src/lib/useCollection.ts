import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Doc {
  id: string;
  [k: string]: unknown;
}

/** Live snapshot of a collection with optional order + limit. Admin-scoped. */
export function useCollection(
  name: string,
  opts: { orderByField?: string; direction?: "asc" | "desc"; limit?: number } = {},
): Doc[] {
  const [docs, setDocs] = useState<Doc[]>([]);
  const { orderByField, direction, limit } = opts;

  useEffect(() => {
    const cons: QueryConstraint[] = [];
    if (orderByField) cons.push(orderBy(orderByField, direction ?? "asc"));
    if (limit) cons.push(fbLimit(limit));
    return onSnapshot(
      query(collection(db, name), ...cons),
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setDocs([]),
    );
  }, [name, orderByField, direction, limit]);

  return docs;
}

export interface RiskPoint {
  t: number;
  score: number;
  band: string;
}

/** Appends each distinct riskScores/{uid} update to a local buffer for charting. */
export function useRiskHistory(uid: string | undefined): RiskPoint[] {
  const [points, setPoints] = useState<RiskPoint[]>([]);
  const last = useRef<string>("");

  useEffect(() => {
    setPoints([]);
    last.current = "";
    if (!uid) return;
    return onSnapshot(doc(db, "riskScores", uid), (snap) => {
      const d = snap.data();
      if (!d) return;
      const key = `${d.score}|${d.band}`;
      if (key === last.current) return;
      last.current = key;
      setPoints((p) => [
        ...p.slice(-59),
        { t: Date.now(), score: d.score ?? 0, band: d.band ?? "NORMAL" },
      ]);
    });
  }, [uid]);

  return points;
}
