export function EmptyThread() {
  return (
    <div className="grid flex-1 place-items-center px-8">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl grad-quantum shadow-[0_10px_40px_-8px_rgba(124,92,255,.6)]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z"
              stroke="#0A0D16"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="m9 12 2 2 4-4.5" stroke="#0A0D16" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold text-text">
          Pick a conversation, or start one
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-faint">
          Every conversation opens with an ML-KEM key exchange — a lattice problem with no quantum
          shortcut. Paste a peer's user ID in the sidebar to begin.
        </p>
      </div>
    </div>
  );
}
