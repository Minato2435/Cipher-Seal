/**
 * The faint ML-KEM point lattice that sits behind everything. Two basis vectors
 * b1, b2 span the lattice; a short "problem" vector is drawn slightly bolder near
 * the origin — the shortest-vector problem is what makes the scheme hard.
 */
export function LatticeField() {
  const pts: { x: number; y: number }[] = [];
  const b1 = { x: 62, y: 0 };
  const b2 = { x: 22, y: 58 };
  for (let i = -6; i <= 18; i++) {
    for (let j = -4; j <= 16; j++) {
      pts.push({ x: i * b1.x + j * b2.x, y: i * b1.y + j * b2.y });
    }
  }
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ color: "#5B6470" }}
    >
      <g transform="translate(120 40)" opacity="0.45">
        {pts.map((p, k) => (
          <circle key={k} cx={p.x} cy={p.y} r={1.1} fill="currentColor" />
        ))}
        <line x1="0" y1="0" x2={b1.x} y2={b1.y} stroke="currentColor" strokeWidth="1" opacity="0.9" />
        <line x1="0" y1="0" x2={b2.x} y2={b2.y} stroke="currentColor" strokeWidth="1" opacity="0.9" />
        <circle cx="0" cy="0" r="2.4" fill="currentColor" />
      </g>
    </svg>
  );
}
