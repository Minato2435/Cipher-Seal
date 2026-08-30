import { Navigate, Route, Routes } from "react-router-dom";
import { LatticeField } from "./components/LatticeField";

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
        <Route path="/login" element={<Placeholder title="Sign in" />} />
        <Route path="/register" element={<Placeholder title="Create an account" />} />
        <Route path="/" element={<Placeholder title="Chat" />} />
        <Route path="/admin" element={<Placeholder title="Security monitor" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
