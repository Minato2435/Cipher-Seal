import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

const cache = new Map<string, string>();

export type PlaintextState =
  | { kind: "loading" }
  | { kind: "ok"; text: string }
  | { kind: "tampered" }
  | { kind: "error" };

/** Lazily decrypt a message via the read_message callable, cached by id. */
export function usePlaintext(messageId: string | undefined): PlaintextState {
  const [state, setState] = useState<PlaintextState>(
    messageId && cache.has(messageId)
      ? { kind: "ok", text: cache.get(messageId)! }
      : { kind: "loading" },
  );

  useEffect(() => {
    if (!messageId) return;
    if (cache.has(messageId)) {
      setState({ kind: "ok", text: cache.get(messageId)! });
      return;
    }
    let live = true;
    api
      .readMessage(messageId)
      .then(({ plaintext }) => {
        cache.set(messageId, plaintext);
        if (live) setState({ kind: "ok", text: plaintext });
      })
      .catch((err) => {
        if (!live) return;
        setState(
          err instanceof ApiError && err.code === "SIGNATURE_INVALID"
            ? { kind: "tampered" }
            : { kind: "error" },
        );
      });
    return () => {
      live = false;
    };
  }, [messageId]);

  return state;
}
