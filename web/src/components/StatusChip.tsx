const MAP: Record<string, string> = {
  normal: "var(--n-500)",
  elevated: "var(--risk-elevated)",
  high: "var(--risk-high)",
  blocked: "var(--risk-critical)",
};

export function StatusChip({ status }: { status?: string }) {
  const color = MAP[status ?? "normal"] ?? MAP.normal;
  return (
    <span className="pill lowercase" style={{ color }}>
      {status ?? "normal"}
    </span>
  );
}
