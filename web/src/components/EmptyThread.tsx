export function EmptyThread() {
  return (
    <div className="thread-wrap">
      <div className="empty-state">
        <svg
          width="52"
          height="40"
          viewBox="0 0 52 40"
          fill="none"
          className="mx-auto mb-4 block"
        >
          <circle cx="8" cy="34" r="1.6" fill="#201f1d" />
          <path d="M8 34 L40 24" stroke="#201f1d" strokeWidth="1.3" />
          <path d="M8 34 L16 6" stroke="#201f1d" strokeWidth="1.3" />
          <path d="M36 21.3 L40 24 L37.6 27.6" stroke="#9c4a22" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          <path d="M12.3 12.3 L16 6 L19 9.4" stroke="#201f1d" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
        </svg>
        <h2 className="font-head text-[26px]">Pick a correspondent, or begin one</h2>
        <p className="empty-caption mt-2">
          Every correspondence opens with an <b>ML-KEM</b> key exchange — a lattice problem with no
          quantum shortcut. Use the + in the sidebar to paste a peer's user ID.
        </p>
      </div>
    </div>
  );
}
