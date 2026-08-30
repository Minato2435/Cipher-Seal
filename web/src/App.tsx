import { Navigate, Route, Routes } from "react-router-dom";
import { LatticeField } from "./components/LatticeField";
import { RequireAdmin, RequireAuth } from "./components/RequireAuth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Chat } from "./pages/Chat";

function Placeholder({ title }: { title: string }) {
  return (
    <main className="lattice-ground min-h-screen px-8 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
        quantum-safe communication
      </p>
      <h1 className="mt-2 font-display text-5xl text-ink">{title}</h1>
    </main>
  );
}

export function App() {
  return (
    <>
      <LatticeField />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Placeholder title="Security monitor" />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
