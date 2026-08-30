import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";

export type ApiErrorCode =
  | "REAUTH_REQUIRED"
  | "ACCOUNT_BLOCKED"
  | "SIGNATURE_INVALID"
  | "DECRYPT_FAILED"
  | "PEER_NOT_READY"
  | "NOT_PARTICIPANT"
  | "SESSION_INACTIVE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_KIND"
  | "UNAUTHENTICATED"
  | "UNKNOWN";

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

// Cloud Functions serialise our AppError as an HttpsError whose message is
// "<CODE>: <human text>". Recover the code so callers can branch on it.
function toApiError(e: unknown): ApiError {
  const fe = e as Partial<FunctionsError> & { message?: string };
  const raw = fe?.message ?? String(e);
  const m = /^([A-Z_]+):\s*([\s\S]*)$/.exec(raw);
  if (m) return new ApiError(m[1] as ApiErrorCode, m[2]);
  if (fe?.code === "functions/unauthenticated")
    return new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  return new ApiError("UNKNOWN", raw);
}

async function call<T>(name: string, data?: unknown): Promise<T> {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data as T;
  } catch (e) {
    throw toApiError(e);
  }
}

export const api = {
  registerKeys: (displayName?: string) =>
    call<{ created: boolean }>("register_keys", { displayName }),
  establishSession: (peerUid: string) =>
    call<{ sessionId: string }>("establish_session", { peerUid }),
  sendMessage: (sessionId: string, plaintext: string) =>
    call<{ messageId: string }>("send_message", { sessionId, plaintext }),
  readMessage: (messageId: string) =>
    call<{ plaintext: string }>("read_message", { messageId }),
  reauth: (password: string) => call<{ ok: boolean }>("reauth", { password }),
  simulateAttack: (kind: string, targetUid?: string) =>
    call<{ events: number }>("simulate_attack", { kind, targetUid }),
  adminSetStatus: (uid: string, status: string) =>
    call<{ ok: boolean }>("admin_set_status", { uid, status }),
};
