import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthUser } from "../lib/useAuthUser";

function Checking() {
  return (
    <main className="lattice-ground grid min-h-screen place-items-center">
      <p className="font-mono text-sm text-ink-soft">checking session…</p>
    </main>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();
  if (loading) return <Checking />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuthUser();
  if (loading) return <Checking />;
  if (!user) return <Navigate to="/login" replace />;
  if (claims.role !== "admin") {
    return (
      <main className="lattice-ground grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl text-ink">Admins only</h1>
          <p className="mt-2 text-sm text-ink-soft">
            The security monitor is limited to administrator accounts.
          </p>
          <Link to="/" className="mt-4 inline-block font-mono text-sm underline">
            Back to chat
          </Link>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
