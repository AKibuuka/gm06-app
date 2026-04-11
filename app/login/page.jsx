"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If already logged in, redirect
  useEffect(() => {
    const hasCookie = document.cookie.includes("gm06_session");
    if (hasCookie) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); setLoading(false); return; }
      router.replace("/dashboard");
    } catch {
      setError("Unable to connect. Check your internet connection.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at 30% 20%, #0f766e15, transparent 50%), #0C1117" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 shadow-lg shadow-brand-700/20">G6</div>
          <h1 className="text-xl font-bold">Green Minds 06</h1>
          <p className="text-sm text-gray-500 mt-1">Investment Club Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-sm rounded-lg px-4 py-2.5">{error}</div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gm06.club" required autoComplete="email" autoFocus
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-700 transition-colors placeholder:text-gray-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-700 transition-colors placeholder:text-gray-600" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-800 disabled:bg-brand-800/50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-[11px] text-gray-600 mt-6">Contact the Treasurer if you need access</p>
      </div>
    </div>
  );
}
