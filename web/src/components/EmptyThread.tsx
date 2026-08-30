/**
 * The main column before a session is picked. A clean drawing of the ML-KEM
 * lattice with its two basis vectors and the "shortest vector" a quantum
 * computer still can't shortcut — plus the one instruction.
 */
export function EmptyThread() {
  const b1 = { x: 78, y: 0 };
  const b2 = { x: 28, y: 70 };
  const pts: { x: number; y: number }[] = [];
  for (let i = -3; i <= 4; i++)
    for (let j = -2; j <= 3; j++)
      pts.push({ x: i * b1.x + j * b2.x, y: i * b1.y + j * b2.y });

  return (
    <div className="grid flex-1 place-items-center px-8">
      <div className="max-w-md text-center">
        <svg
          viewBox="-190 -170 380 320"
          className="mx-auto h-44 w-full text-ink-soft"
          aria-hidden="true"
        >
          {pts.map((p, k) => (
            <circle key={k} cx={p.x} cy={p.y} r={2} fill="currentColor" opacity={0.5} />
          ))}
          {/* basis vectors */}
          <line x1="0" y1="0" x2={b1.x} y2={b1.y} stroke="#14181F" strokeWidth="1.5" />
          <line x1="0" y1="0" x2={b2.x} y2={b2.y} stroke="#14181F" strokeWidth="1.5" />
          {/* the short "hard" vector */}
          <line x1="0" y1="0" x2={b2.x - b1.x} y2={b2.y - b1.y} stroke="#C1541F" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="3.5" fill="#14181F" />
        </svg>
        <h2 className="mt-6 font-display text-3xl text-ink">Pick a session, or start one</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Every session opens with an ML-KEM exchange — a lattice problem with no quantum shortcut.
          Paste a peer's user ID in the sidebar to begin.
        </p>
      </div>
    </div>
  );
}
