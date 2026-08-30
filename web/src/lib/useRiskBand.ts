import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface RiskState {
  score: number;
  band: string;
  modelScore: number;
  ruleBoost: number;
  components: Record<string, number>;
  loaded: boolean;
}

const EMPTY: RiskState = {
  score: 0,
  band: "NORMAL",
  modelScore: 0,
  ruleBoost: 0,
  components: {},
  loaded: false,
};

/** Live risk score for a user, from riskScores/{uid}. */
export function useRiskBand(uid: string | undefined): RiskState {
  const [state, setState] = useState<RiskState>(EMPTY);

  useEffect(() => {
    if (!uid) {
      setState(EMPTY);
      return;
    }
    return onSnapshot(
      doc(db, "riskScores", uid),
      (snap) => {
        const d = snap.data();
        if (!d) {
          setState({ ...EMPTY, loaded: true });
          return;
        }
        setState({
          score: d.score ?? 0,
          band: d.band ?? "NORMAL",
          modelScore: d.modelScore ?? 0,
          ruleBoost: d.ruleBoost ?? 0,
          components: d.components ?? {},
          loaded: true,
        });
      },
      () => setState({ ...EMPTY, loaded: true }),
    );
  }, [uid]);

  return state;
}
