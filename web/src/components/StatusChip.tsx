const MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "normal", color: "#5B6478" },
  elevated: { label: "elevated", color: "#F2A93B" },
  high: { label: "high", color: "#F26430" },
  blocked: { label: "blocked", color: "#F03D5F" },
};

export function StatusChip({ status }: { status?: string }) {
  const s = MAP[status ?? "normal"] ?? MAP.normal;
  return (
    <span className="pill lowercase" style={{ color: s.color }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
      />
      {s.label}
    </span>
  );
}
