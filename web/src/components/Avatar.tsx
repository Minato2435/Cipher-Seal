import { avatarGradient } from "../lib/conversations";

export function Avatar({
  uid,
  name,
  size = 34,
  ring = false,
}: {
  uid: string;
  name: string;
  size?: number;
  ring?: boolean;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-display font-semibold text-base/[1] text-black/70"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundImage: avatarGradient(uid),
        boxShadow: ring ? "0 0 0 2px rgba(124,92,255,.9), 0 0 14px rgba(124,92,255,.5)" : "none",
      }}
    >
      {initials}
    </span>
  );
}
