"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { Lock, User, Globe, Save, Shield, Copy, Eye, EyeOff } from "lucide-react";
import { FormField, inputClass, btnPrimary, btnSecondary } from "@/components/Modal";

export default function SettingsPage() {
  const user = useUser();
  const toast = useToast();

  // Password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // MFA
  const [mfaSetup, setMfaSetup] = useState(null); // { secret, qr_code }
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  // Club settings (admin)
  const [settings, setSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/settings").then((r) => r.json()).then((d) => { setSettings(d); setSettingsLoading(false); }).catch(() => setSettingsLoading(false));
    } else {
      setSettingsLoading(false);
    }
    // Check MFA status from /api/me
    fetch("/api/me").then((r) => r.json()).then((d) => {
      if (d?.member) setMfaEnabled(!!d.member.mfa_enabled);
    }).catch(() => {});
  }, [user]);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast?.("Passwords don't match", "error"); return; }
    if (newPwd.length < 6) { toast?.("Minimum 6 characters", "error"); return; }
    setPwdSubmitting(true);
    try {
      const res = await fetch("/api/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast?.("Password changed", "success");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) { toast?.(e.message, "error"); }
    setPwdSubmitting(false);
  }

  async function handleMFASetup() {
    setMfaLoading(true);
    try {
      const res = await fetch("/api/mfa", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMfaSetup(data);
    } catch (e) { toast?.(e.message, "error"); }
    setMfaLoading(false);
  }

  async function handleMFAVerify(e) {
    e.preventDefault();
    setMfaLoading(true);
    try {
      const res = await fetch("/api/mfa", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: mfaSetup.secret, code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMfaBackupCodes(data.backup_codes);
      setMfaEnabled(true);
      setMfaSetup(null);
      setMfaCode("");
      toast?.("MFA enabled successfully", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setMfaLoading(false);
  }

  async function handleMFADisable(e) {
    e.preventDefault();
    setMfaLoading(true);
    try {
      const res = await fetch("/api/mfa", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMfaEnabled(false);
      setShowDisable(false);
      setDisablePwd("");
      toast?.("MFA disabled", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setMfaLoading(false);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsSubmitting(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error("Failed to save");
      toast?.("Settings saved", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSettingsSubmitting(false);
  }

  if (!user) return null;

  return (
    <div className="animate-in max-w-lg">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Account and club settings</p>
      </div>

      {/* Profile */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4"><User size={18} className="text-gray-400" /><span className="text-sm font-semibold">Profile</span></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Name</span><span>{user.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-mono text-xs">{user.email}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Role</span><span className="capitalize">{user.role}</span></div>
        </div>
      </div>

      {/* Password */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4"><Lock size={18} className="text-gray-400" /><span className="text-sm font-semibold">Change Password</span></div>
        <form onSubmit={handleChangePassword} className="space-y-1">
          <FormField label="Current Password"><input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required className={inputClass} autoComplete="current-password" /></FormField>
          <FormField label="New Password"><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6} className={inputClass} autoComplete="new-password" /></FormField>
          <FormField label="Confirm"><input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required minLength={6} className={inputClass} autoComplete="new-password" /></FormField>
          <button type="submit" disabled={pwdSubmitting} className={`w-full ${btnPrimary} mt-2`}>{pwdSubmitting ? "Changing..." : "Change Password"}</button>
        </form>
      </div>

      {/* MFA */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4"><Shield size={18} className="text-gray-400" /><span className="text-sm font-semibold">Two-Factor Authentication</span></div>

        {mfaBackupCodes && (
          <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-amber-400 mb-2">Save your backup codes</div>
            <p className="text-xs text-gray-400 mb-3">These codes can be used to log in if you lose access to your authenticator app. Each code can only be used once. Save them somewhere safe.</p>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {mfaBackupCodes.map((code) => (
                <div key={code} className="bg-surface-2 rounded px-3 py-1.5 font-mono text-xs text-center">{code}</div>
              ))}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(mfaBackupCodes.join("\n")); toast?.("Codes copied", "success"); }}
              className={`w-full ${btnSecondary} text-xs flex items-center justify-center gap-2`}><Copy size={12} />Copy All Codes</button>
            <button onClick={() => setMfaBackupCodes(null)} className="w-full text-xs text-gray-500 hover:text-gray-400 mt-2">I've saved them</button>
          </div>
        )}

        {mfaEnabled && !mfaSetup && !mfaBackupCodes && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-green-400 font-medium">MFA is enabled</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Your account is protected with two-factor authentication.</p>
            {!showDisable ? (
              <button onClick={() => setShowDisable(true)} className={`${btnSecondary} text-xs px-4`}>Disable MFA</button>
            ) : (
              <form onSubmit={handleMFADisable} className="space-y-3">
                <FormField label="Enter your password to disable MFA">
                  <input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} required className={inputClass} autoComplete="current-password" />
                </FormField>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowDisable(false); setDisablePwd(""); }} className={`flex-1 ${btnSecondary} text-xs`}>Cancel</button>
                  <button type="submit" disabled={mfaLoading} className="flex-1 bg-red-700 hover:bg-red-800 text-white font-medium py-2.5 rounded-lg text-xs transition-colors disabled:opacity-50">{mfaLoading ? "Disabling..." : "Disable MFA"}</button>
                </div>
              </form>
            )}
          </div>
        )}

        {!mfaEnabled && !mfaSetup && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Add an extra layer of security. You'll need an authenticator app like Google Authenticator or Authy.</p>
            <button onClick={handleMFASetup} disabled={mfaLoading} className={`${btnPrimary} text-xs px-4 flex items-center gap-2`}>
              <Shield size={14} />{mfaLoading ? "Setting up..." : "Enable MFA"}
            </button>
          </div>
        )}

        {mfaSetup && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
            <div className="flex justify-center mb-4">
              <img src={mfaSetup.qr_code} alt="MFA QR Code" className="w-48 h-48 rounded-lg" />
            </div>
            <div className="bg-surface-2 rounded-lg px-3 py-2 mb-4 text-center">
              <div className="text-[10px] text-gray-500 mb-1">Manual entry key</div>
              <div className="font-mono text-xs text-gray-300 break-all select-all">{mfaSetup.secret}</div>
            </div>
            <form onSubmit={handleMFAVerify}>
              <FormField label="Enter the 6-digit code from your app">
                <input type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required maxLength={6} placeholder="000000" autoComplete="one-time-code"
                  className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`} />
              </FormField>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setMfaSetup(null); setMfaCode(""); }} className={`flex-1 ${btnSecondary} text-xs`}>Cancel</button>
                <button type="submit" disabled={mfaLoading || mfaCode.length !== 6} className={`flex-1 ${btnPrimary} text-xs`}>{mfaLoading ? "Verifying..." : "Verify & Enable"}</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Club Settings (admin only) */}
      {user.role === "admin" && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><Globe size={18} className="text-gray-400" /><span className="text-sm font-semibold">Club Settings</span></div>
          {settingsLoading ? <div className="text-gray-500 text-sm">Loading...</div> : (
            <form onSubmit={handleSaveSettings} className="space-y-1">
              <FormField label="Required Monthly Contribution (UGX)">
                <input type="number" step="1000" min="0" value={settings.required_contribution || ""} onChange={(e) => setSettings({ ...settings, required_contribution: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Amount each member must contribute monthly. Members will be notified if behind. Current: {settings.required_contribution ? parseInt(settings.required_contribution).toLocaleString() : "Not set"}</p>
              </FormField>
              <FormField label="USD to UGX Exchange Rate">
                <input type="number" step="0.01" value={settings.ugx_rate || ""} onChange={(e) => setSettings({ ...settings, ugx_rate: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Used when converting crypto prices from USD. Current: {settings.ugx_rate || "3691"}</p>
              </FormField>
              <FormField label="Statement Date">
                <input type="date" value={settings.statement_date || ""} onChange={(e) => setSettings({ ...settings, statement_date: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Date shown on generated statements</p>
              </FormField>
              <FormField label="Max Loan (% of Portfolio)">
                <input type="number" step="1" min="0" max="100" value={settings.max_loan_pct || ""} onChange={(e) => setSettings({ ...settings, max_loan_pct: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Members can borrow up to this % of their portfolio value. Current: {settings.max_loan_pct || "80"}%</p>
              </FormField>
              <FormField label="Loan Interest Rate (% per quarter)">
                <input type="number" step="0.1" min="0" value={settings.loan_interest_rate || ""} onChange={(e) => setSettings({ ...settings, loan_interest_rate: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Flat interest rate for the 3-month loan period. Current: {settings.loan_interest_rate || "10"}%</p>
              </FormField>
              <button type="submit" disabled={settingsSubmitting} className={`w-full ${btnPrimary} mt-2 flex items-center justify-center gap-2`}>
                <Save size={14} />{settingsSubmitting ? "Saving..." : "Save Settings"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
