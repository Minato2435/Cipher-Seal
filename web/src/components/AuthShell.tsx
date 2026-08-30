import type { ReactNode } from "react";

/** Shared frame for the sign-in / register screens. */
export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="lattice-ground grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        {/* the two lattice basis vectors, as a maker's mark */}
        <svg width="34" height="34" viewBox="-4 -4 42 42" aria-hidden="true" className="text-ink">
          <line x1="0" y1="34" x2="30" y2="34" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="34" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="0" cy="34" r="2.4" fill="currentColor" />
        </svg>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          quantum-safe communication
        </p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-ink">{title}</h1>
        <div className="mt-8">{children}</div>
        <p className="mt-6 text-sm text-ink-soft">{footer}</p>
      </div>
    </main>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full border border-ink-soft/50 bg-white px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink"
      />
    </label>
  );
}
