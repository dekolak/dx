"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Connexion impossible");
        return;
      }
      router.push(search.get("next") || "/");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="login-card card" onSubmit={submit}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>DX — Référencement</h1>
        <p className="sub" style={{ marginBottom: 16 }}>Connexion atelier</p>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoComplete="username"
          required
        />
        <label>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn primary" style={{ width: "100%", marginTop: 14 }} disabled={busy} type="submit">
          {busy ? "…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
