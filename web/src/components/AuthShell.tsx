import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl grad-quantum shadow-[0_10px_40px_-8px_rgba(124,92,255,.6)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z"
              stroke="#0A0D16"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="m9 12 2 2 4-4.5" stroke="#0A0D16" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan">
          quantum-safe communication
        </p>
        <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight text-text">
          {title}
        </h1>
        <p className="mt-1 text-[13.5px] text-faint">{subtitle}</p>
        <div className="mt-7">{children}</div>
        <p className="mt-6 text-[13px] text-faint">{footer}</p>
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
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
      <input {...props} className="input mt-1.5" />
    </label>
  );
}
