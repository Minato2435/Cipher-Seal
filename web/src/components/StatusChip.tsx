const MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "normal", color: "#3A4453" },
  elevated: { label: "elevated", color: "#C98A2B" },
  high: { label: "high", color: "#C1541F" },
  blocked: { label: "blocked", color: "#A01E22" },
};

export function StatusChip({ status }: { status?: string }) {
  const s = MAP[status ?? "normal"] ?? MAP.normal;
  return (
    <span
      className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] lowercase"
      style={{ color: s.color, borderColor: `${s.color}66` }}
    >
      <span className="inline-block h-1.5 w-1.5" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
