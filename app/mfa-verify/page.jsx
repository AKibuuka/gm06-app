"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

function MFAVerifyForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef(null);

  const tempToken = searchParams.get("t");
  const memberName = searchParams.get("name") || "";

  useEffect(() => {
    if (!tempToken) router.replace("/login");
    inputRef.current?.focus();
  }, [tempToken, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Verification failed"); setLoading(false); return; }
      router.replace("/dashboard");
    } catch {
      setError("Unable to connect. Check your internet connection.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at 30% 20%, #0f766e15, transparent 50%), #0C1117" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-700/20">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
          {memberName && <p className="text-sm text-gray-500 mt-1">Welcome back, {memberName}</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-sm rounded-lg px-4 py-2.5">{error}</div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Authentication Code</label>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              placeholder="Enter 6-digit code"
              required
              autoComplete="one-time-code"
              maxLength={8}
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-white outline-none focus:border-brand-700 transition-colors placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-sm"
            />
          </div>
          <button type="submit" disabled={loading || code.length < 6}
            className="w-full bg-brand-700 hover:bg-brand-800 disabled:bg-brand-800/50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {loading ? "Verifying..." : "Verify"}
          </button>
          <div className="text-center">
            <p className="text-[11px] text-gray-500">Open your authenticator app to get the code</p>
            <p className="text-[11px] text-gray-600 mt-1">Or enter a backup recovery code</p>
          </div>
        </form>
        <button onClick={() => router.push("/login")} className="w-full text-center text-xs text-gray-500 hover:text-gray-400 mt-4">
          Back to login
        </button>
      </div>
    </div>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#0C1117" }}><span className="text-gray-500 text-sm">Loading...</span></div>}>
      <MFAVerifyForm />
    </Suspense>
  );
}
