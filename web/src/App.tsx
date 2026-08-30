import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthUser } from "./lib/useAuthUser";
import { RequireAdmin } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Chat } from "./pages/Chat";
import { Admin } from "./pages/Admin";

function Root() {
  const { user, loading } = useAuthUser();
  if (loading)
    return (
      <div className="frame-outer">
        <div className="risk-frame">
          <div className="auth-wrap">
            <p className="mono text-[13px] text-[color:var(--n-600)]">Checking session…</p>
          </div>
        </div>
      </div>
    );
  return user ? <Chat /> : <Home />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Admin />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
