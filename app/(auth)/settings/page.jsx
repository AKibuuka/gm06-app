"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { Lock, User, Globe, Save } from "lucide-react";
import { FormField, inputClass, btnPrimary } from "@/components/Modal";

export default function SettingsPage() {
  const user = useUser();
  const toast = useToast();

  // Password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Club settings (admin)
  const [settings, setSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => { setSettings(d); setSettingsLoading(false); }).catch(() => setSettingsLoading(false));
  }, []);

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

      {/* Club Settings (admin only) */}
      {user.role === "admin" && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><Globe size={18} className="text-gray-400" /><span className="text-sm font-semibold">Club Settings</span></div>
          {settingsLoading ? <div className="text-gray-500 text-sm">Loading...</div> : (
            <form onSubmit={handleSaveSettings} className="space-y-1">
              <FormField label="USD to UGX Exchange Rate">
                <input type="number" step="0.01" value={settings.ugx_rate || ""} onChange={(e) => setSettings({ ...settings, ugx_rate: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Used when converting crypto prices from USD. Current: {settings.ugx_rate || "3691"}</p>
              </FormField>
              <FormField label="Statement Date">
                <input type="date" value={settings.statement_date || ""} onChange={(e) => setSettings({ ...settings, statement_date: e.target.value })} className={inputClass} />
                <p className="text-[11px] text-gray-500 mt-1">Date shown on generated statements</p>
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
