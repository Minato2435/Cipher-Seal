const RAMP: Record<string, string> = {
  NORMAL: "#3A4453",
  ELEVATED: "#C98A2B",
  HIGH: "#C1541F",
  CRITICAL: "#A01E22",
};

/** Colour for a risk band; unknown bands fall back to the calm end. */
export function bandColor(band: string): string {
  return RAMP[band] ?? RAMP.NORMAL;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64 → lowercase hex, a space between every byte. */
export function groupHex(b64: string): string {
  return Array.from(b64ToBytes(b64))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

/** Keep the head and tail of a long string, ellipsis in the middle. */
export function middleTruncate(s: string, max = 24): string {
  if (s.length <= max) return s;
  const keep = Math.max(3, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

/** First 16 hex chars of SHA-256(bytes(b64)) — a short session-key fingerprint. */
export async function fingerprint(b64: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", b64ToBytes(b64));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
