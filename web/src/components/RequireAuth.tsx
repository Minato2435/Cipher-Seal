import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthUser } from "../lib/useAuthUser";

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="frame-outer">
      <div className="risk-frame">
        <div className="auth-wrap">{children}</div>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();
  if (loading)
    return (
      <Centered>
        <p className="mono text-[13px] text-[color:var(--n-600)]">Checking session…</p>
      </Centered>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuthUser();
  if (loading)
    return (
      <Centered>
        <p className="mono text-[13px] text-[color:var(--n-600)]">Checking session…</p>
      </Centered>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (claims.role !== "admin") {
    return (
      <Centered>
        <h1 className="font-head text-3xl">Admins only</h1>
        <p className="empty-caption mt-2">
          The security monitor is limited to administrator accounts.
        </p>
        <Link to="/" className="link-muted mt-4 inline-block">
          ← Back to correspondence
        </Link>
      </Centered>
    );
  }
  return <>{children}</>;
}
