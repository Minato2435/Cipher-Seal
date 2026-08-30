import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthUser } from "../lib/useAuthUser";

function Checking() {
  return (
    <main className="grid min-h-screen place-items-center">
      <p className="font-mono text-sm text-faint">checking session…</p>
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
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold text-text">Admins only</h1>
          <p className="mt-2 text-sm text-faint">
            The security monitor is limited to administrator accounts.
          </p>
          <Link to="/" className="mt-4 inline-block font-mono text-sm text-quantum">
            ← back to chat
          </Link>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
