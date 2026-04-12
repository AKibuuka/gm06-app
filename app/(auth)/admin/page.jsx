"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { Users, PieChart, Calculator, AlertTriangle, Plus, Pencil, Key, Copy, Landmark, Megaphone, Trash2, ScrollText } from "lucide-react";
import Modal, { FormField, inputClass, selectClass, btnPrimary, btnSecondary } from "@/components/Modal";
import Confirm from "@/components/Confirm";
import { fmtUGX, fmtShort, fmtDate, titleCase, ASSET_CLASS_LABELS } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

const TABS = [
  { id: "valuation", label: "Valuation", icon: Calculator },
  { id: "members", label: "Members", icon: Users },
  { id: "investments", label: "Investments", icon: PieChart },
  { id: "fines", label: "Fines", icon: AlertTriangle },
  { id: "loans", label: "Loans", icon: Landmark },
  { id: "announcements", label: "Announce", icon: Megaphone },
  { id: "audit", label: "Audit Log", icon: ScrollText },
];
const ASSET_CLASSES = ["fixed_income", "stocks", "digital_assets", "real_estate", "private_equity", "loans", "cash"];

export default function AdminPage() {
  const user = useUser();
  const router = useRouter();
  const toast = useToast();

  useTitle("Admin Panel");
  useEffect(() => { if (user && user.role !== "admin") router.replace("/dashboard"); }, [user, router]);

  const [tab, setTab] = useState("valuation");
  const [members, setMembers] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [fines, setFines] = useState([]);
  const [loans, setLoans] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [showFineForm, setShowFineForm] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newMemberCreds, setNewMemberCreds] = useState(null);
  const [editItem, setEditItem] = useState(null);

  // Forms
  const [memberForm, setMemberForm] = useState({ name: "", email: "", phone: "", monthly_contribution: 0, role: "member" });
  const [invForm, setInvForm] = useState({ name: "", ticker: "", asset_class: "stocks", quantity: "", cost_basis: "", current_price: "", current_value: "", price_source: "manual", notes: "" });
  const [fineForm, setFineForm] = useState({ member_id: "", amount: "", reason: "", date: new Date().toISOString().split("T")[0] });
  const [resetForm, setResetForm] = useState({ member_id: "", new_password: "" });
  const [announceForm, setAnnounceForm] = useState({ title: "", body: "", pinned: false });
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, danger }
  const [valDate, setValDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
  const [valResult, setValResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/investments").then((r) => r.json()),
      fetch("/api/fines").then((r) => r.json()),
      fetch("/api/snapshots").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/announcements").then((r) => r.json()),
    ]).then(([m, i, f, s, l, a]) => {
      setMembers(Array.isArray(m) ? m : []);
      setInvestments(Array.isArray(i) ? i : []);
      setFines(Array.isArray(f) ? f : []);
      setSnapshots(Array.isArray(s) ? s : []);
      setLoans(Array.isArray(l) ? l : []);
      setAnnouncements(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => { toast?.("Failed to load data", "error"); setLoading(false); });
  }, [user]);

  // Lazy-load audit logs when tab is selected
  useEffect(() => {
    if (tab !== "audit" || auditLogs.length > 0) return;
    fetch("/api/audit?limit=200").then((r) => r.json()).then((d) => setAuditLogs(Array.isArray(d) ? d : []));
  }, [tab]);

  if (!user || user.role !== "admin") return null;
  if (loading) return <SkeletonPage cards={3} rows={5} />;

  const activeInvestments = investments.filter((i) => i.is_active !== false);
  const totalPortfolioValue = activeInvestments.reduce((s, i) => s + (i.current_value || 0), 0);

  // ── Helpers ──
  async function apiCall(url, method, body) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function refreshData() {
    const [m, i, f, s, l, a] = await Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/investments").then((r) => r.json()),
      fetch("/api/fines").then((r) => r.json()),
      fetch("/api/snapshots").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/announcements").then((r) => r.json()),
    ]);
    setMembers(Array.isArray(m) ? m : []);
    setInvestments(Array.isArray(i) ? i : []);
    setFines(Array.isArray(f) ? f : []);
    setSnapshots(Array.isArray(s) ? s : []);
    setLoans(Array.isArray(l) ? l : []);
    setAnnouncements(Array.isArray(a) ? a : []);
  }

  // ── Valuation ──
  async function generateValuation() {
    setGenerating(true);
    setValResult(null);
    try {
      const data = await apiCall("/api/snapshots", "POST", { date: valDate });
      setValResult(data);
      toast?.(`Valuation generated: ${fmtUGX(data.totalPortfolioValue)} across ${data.membersProcessed} members`, "success");
      await refreshData();
    } catch (e) { setValResult({ error: e.message }); toast?.(e.message, "error"); }
    setGenerating(false);
  }

  // ── Members ──
  async function saveMember(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editItem) {
        await apiCall("/api/members", "PUT", { id: editItem.id, ...memberForm });
        toast?.("Member updated", "success");
      } else {
        const data = await apiCall("/api/members", "POST", memberForm);
        setNewMemberCreds({ name: data.name, email: data.email, password: data.default_password });
        toast?.("Member added", "success");
      }
      setShowMemberForm(false);
      setEditItem(null);
      setMemberForm({ name: "", email: "", phone: "", monthly_contribution: 0, role: "member" });
      await refreshData();
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  // ── Investments ──
  async function saveInvestment(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const method = editItem ? "PUT" : "POST";
      const body = editItem ? { id: editItem.id, ...invForm } : invForm;
      await apiCall("/api/investments", method, body);
      toast?.(editItem ? "Investment updated" : "Investment added", "success");
      setShowInvestmentForm(false);
      setEditItem(null);
      setInvForm({ name: "", ticker: "", asset_class: "stocks", quantity: "", cost_basis: "", current_price: "", current_value: "", price_source: "manual", notes: "" });
      await refreshData();
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  // ── Fines ──
  async function saveFine(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiCall("/api/fines", "POST", fineForm);
      toast?.("Fine recorded", "success");
      setShowFineForm(false);
      setFineForm({ member_id: "", amount: "", reason: "", date: new Date().toISOString().split("T")[0] });
      await refreshData();
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  async function toggleFinePaid(fine) {
    try {
      await apiCall("/api/fines", "PUT", { id: fine.id, is_paid: !fine.is_paid });
      toast?.(fine.is_paid ? "Marked as unpaid" : "Marked as paid", "success");
      await refreshData();
    } catch (e) { toast?.(e.message, "error"); }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiCall("/api/password", "PUT", resetForm);
      toast?.("Password reset successfully", "success");
      setShowPasswordReset(false);
      setResetForm({ member_id: "", new_password: "" });
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  return (
    <div className="animate-in">
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} onConfirm={confirm?.onConfirm || (() => {})} confirmText={confirm?.confirmText || "Confirm"} danger={confirm?.danger} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Manage club operations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-1 border border-surface-3 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (<button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === t.id ? "bg-brand-700 text-white" : "text-gray-400 hover:text-white"}`}><Icon size={16} />{t.label}</button>);
        })}
      </div>

      {/* New member credentials modal */}
      <Modal open={!!newMemberCreds} onClose={() => setNewMemberCreds(null)} title="New Member Created">
        {newMemberCreds && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Share these login credentials with the new member:</p>
            <div className="bg-surface-2 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="text-white">{newMemberCreds.name}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="text-white">{newMemberCreds.email}</span></div>
              <div><span className="text-gray-500">Password:</span> <span className="text-green-400">{newMemberCreds.password}</span></div>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(`Email: ${newMemberCreds.email}\nPassword: ${newMemberCreds.password}`); toast?.("Copied to clipboard", "success"); }}
              className={`w-full ${btnPrimary} flex items-center justify-center gap-2`}><Copy size={14} />Copy Credentials</button>
          </div>
        )}
      </Modal>

      {/* ═══ VALUATION ═══ */}
      {tab === "valuation" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-2">Generate Monthly Valuation</h3>
            <p className="text-xs text-gray-500 mb-4">Calculates each member's portfolio share from their contributions and current investment values. Run at the start of each month after updating prices.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div><label className="block text-xs text-gray-500 mb-1.5">Date</label><input type="date" value={valDate} onChange={(e) => setValDate(e.target.value)} className={inputClass} style={{ width: 180 }} /></div>
              <button onClick={generateValuation} disabled={generating} className={`${btnPrimary} px-6 h-[42px] flex items-center gap-2`}>
                <Calculator size={16} />{generating ? "Generating..." : "Generate"}
              </button>
            </div>
            {valResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${valResult.ok ? "bg-green-900/20 border border-green-800/30 text-green-400" : "bg-red-900/20 border border-red-800/30 text-red-400"}`}>
                {valResult.ok ? <>Generated for <strong>{valResult.date}</strong> — {fmtUGX(valResult.totalPortfolioValue)} across {valResult.membersProcessed} members</> : valResult.error}
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">History</h3>
            {snapshots.length === 0 ? <div className="py-4 text-center text-gray-500 text-sm">No valuations yet</div> : (
              <div className="divide-y divide-surface-3">{snapshots.slice(0, 12).map((s) => (
                <div key={s.id} className="flex justify-between items-center py-2.5 text-sm">
                  <span className="font-mono text-gray-400">{fmtDate(s.date)}</span>
                  <span className="font-mono font-semibold">{fmtUGX(s.total_value)}</span>
                  <span className={`text-xs font-semibold ${s.total_value >= s.total_invested ? "text-green-400" : "text-red-400"}`}>{s.total_invested > 0 ? `${(((s.total_value - s.total_invested) / s.total_invested) * 100).toFixed(1)}%` : "-"}</span>
                </div>
              ))}</div>
            )}
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Current Portfolio: <span className="font-mono">{fmtUGX(totalPortfolioValue)}</span></h3>
            <div className="space-y-2">{ASSET_CLASSES.map((cls) => {
              const value = activeInvestments.filter((i) => i.asset_class === cls).reduce((s, i) => s + (i.current_value || 0), 0);
              if (!value) return null;
              return (<div key={cls} className="flex justify-between text-sm"><span className="text-gray-400">{ASSET_CLASS_LABELS[cls]}</span><span className="font-mono">{fmtUGX(value)} <span className="text-gray-500 text-xs">({((value / totalPortfolioValue) * 100).toFixed(1)}%)</span></span></div>);
            })}</div>
          </div>
        </div>
      )}

      {/* ═══ MEMBERS ═══ */}
      {tab === "members" && (
        <div>
          <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{members.length} members</span>
            <div className="flex gap-2">
              <button onClick={() => { setResetForm({ member_id: "", new_password: "" }); setShowPasswordReset(true); }} className={`${btnSecondary} px-3 flex items-center gap-2 text-xs`}><Key size={14} />Reset Password</button>
              <button onClick={() => { setEditItem(null); setMemberForm({ name: "", email: "", phone: "", monthly_contribution: 0, role: "member" }); setShowMemberForm(true); }} className={`${btnPrimary} px-3 flex items-center gap-2 text-xs`}><Plus size={14} />Add Member</button>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">{members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}{m.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-700/20 text-brand-500 font-semibold">Admin</span>}</div>
                <div className="text-[11px] text-gray-500">{m.email} · {m.phone || "—"}</div>
              </div>
              <div className="text-right text-xs text-gray-400 hidden sm:block">Monthly: {m.monthly_contribution > 0 ? fmtUGX(m.monthly_contribution) : "None"}</div>
              <button onClick={() => { setEditItem(m); setMemberForm({ name: m.name, email: m.email, phone: m.phone || "", monthly_contribution: m.monthly_contribution || 0, role: m.role || "member" }); setShowMemberForm(true); }}
                className="p-1.5 rounded hover:bg-surface-3 text-gray-400 hover:text-white"><Pencil size={14} /></button>
            </div>
          ))}</div>

          <Modal open={showMemberForm} onClose={() => { setShowMemberForm(false); setEditItem(null); }} title={editItem ? "Edit Member" : "Add Member"}>
            <form onSubmit={saveMember} className="space-y-1">
              <FormField label="Full Name"><input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required className={inputClass} placeholder="e.g. JOHN DOE" /></FormField>
              <FormField label="Email"><input type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} required className={inputClass} placeholder="john.doe@gm06.club" /></FormField>
              <FormField label="Phone"><input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} className={inputClass} placeholder="256700000000" /></FormField>
              <FormField label="Monthly Contribution (UGX)"><input type="number" value={memberForm.monthly_contribution} onChange={(e) => setMemberForm({ ...memberForm, monthly_contribution: parseFloat(e.target.value) || 0 })} className={inputClass} /></FormField>
              {editItem && (
                <FormField label="Role">
                  <select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className={selectClass}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </FormField>
              )}
              {!editItem && <p className="text-xs text-gray-500 pt-1">Default password: gm06-{"{"} last 4 digits of phone {"}"}</p>}
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setShowMemberForm(false); setEditItem(null); }} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Saving..." : "Save"}</button></div>
            </form>
          </Modal>

          <Modal open={showPasswordReset} onClose={() => setShowPasswordReset(false)} title="Reset Member Password">
            <form onSubmit={resetPassword} className="space-y-1">
              <FormField label="Member"><select value={resetForm.member_id} onChange={(e) => setResetForm({ ...resetForm, member_id: e.target.value })} required className={selectClass}><option value="">Select...</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</option>)}</select></FormField>
              <FormField label="New Password"><input type="text" value={resetForm.new_password} onChange={(e) => setResetForm({ ...resetForm, new_password: e.target.value })} required minLength={6} className={inputClass} placeholder="Minimum 6 characters" /></FormField>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowPasswordReset(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Resetting..." : "Reset Password"}</button></div>
            </form>
          </Modal>
        </div>
      )}

      {/* ═══ INVESTMENTS ═══ */}
      {tab === "investments" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{activeInvestments.length} investments · {fmtUGX(totalPortfolioValue)}</span>
            <button onClick={() => { setEditItem(null); setInvForm({ name: "", ticker: "", asset_class: "stocks", quantity: "", cost_basis: "", current_price: "", current_value: "", price_source: "manual", notes: "" }); setShowInvestmentForm(true); }}
              className={`${btnPrimary} px-3 flex items-center gap-2 text-xs`}><Plus size={14} />Add</button>
          </div>
          {ASSET_CLASSES.map((cls) => {
            const clsInv = activeInvestments.filter((i) => i.asset_class === cls);
            if (!clsInv.length) return null;
            return (
              <div key={cls} className="card p-0 overflow-hidden mb-4">
                <div className="px-5 py-3 border-b border-surface-3 flex justify-between items-center bg-surface-2"><span className="text-sm font-semibold">{ASSET_CLASS_LABELS[cls]}</span><span className="text-sm font-mono">{fmtUGX(clsInv.reduce((s, i) => s + (i.current_value || 0), 0))}</span></div>
                <div className="overflow-x-auto"><div className="min-w-[700px]">{clsInv.map((inv) => (
                  <div key={inv.id} className="grid grid-cols-6 items-center px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]">
                    <div><div className="font-medium">{inv.name}</div>{inv.ticker && <div className="text-[11px] text-gray-500">{inv.ticker}</div>}</div>
                    <div className="text-right font-mono text-gray-400">{Number(inv.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                    <div className="text-right font-mono text-gray-400">{fmtShort(inv.cost_basis)}</div>
                    <div className="text-right font-mono font-semibold">{fmtShort(inv.current_value)}</div>
                    <div className="text-right text-[11px] text-gray-500">{inv.price_source}</div>
                    <div className="text-right"><button onClick={() => { setEditItem(inv); setInvForm({ name: inv.name, ticker: inv.ticker || "", asset_class: inv.asset_class, quantity: inv.quantity, cost_basis: inv.cost_basis, current_price: inv.current_price, current_value: inv.current_value, price_source: inv.price_source, notes: inv.notes || "" }); setShowInvestmentForm(true); }} className="p-1.5 rounded hover:bg-surface-3 text-gray-400 hover:text-white"><Pencil size={14} /></button></div>
                  </div>
                ))}</div></div>
              </div>
            );
          })}
          <Modal open={showInvestmentForm} onClose={() => { setShowInvestmentForm(false); setEditItem(null); }} title={editItem ? "Edit Investment" : "Add Investment"} wide>
            <form onSubmit={saveInvestment} className="space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Name"><input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })} required className={inputClass} /></FormField>
                <FormField label="Ticker"><input value={invForm.ticker} onChange={(e) => setInvForm({ ...invForm, ticker: e.target.value })} className={inputClass} placeholder="e.g. BTC" /></FormField>
                <FormField label="Asset Class"><select value={invForm.asset_class} onChange={(e) => setInvForm({ ...invForm, asset_class: e.target.value })} className={selectClass}>{ASSET_CLASSES.map((c) => <option key={c} value={c}>{ASSET_CLASS_LABELS[c]}</option>)}</select></FormField>
                <FormField label="Price Source"><select value={invForm.price_source} onChange={(e) => setInvForm({ ...invForm, price_source: e.target.value })} className={selectClass}><option value="manual">Manual</option><option value="binance">Binance (Crypto)</option><option value="yahoo">Yahoo Finance (Stocks/ETFs)</option><option value="stablecoin">Stablecoin ($1)</option><option value="uap">UAP Fund</option></select></FormField>
                <FormField label="Quantity"><input type="number" step="any" value={invForm.quantity} onChange={(e) => setInvForm({ ...invForm, quantity: e.target.value })} className={inputClass} /></FormField>
                <FormField label="Cost Basis (UGX)"><input type="number" step="any" value={invForm.cost_basis} onChange={(e) => setInvForm({ ...invForm, cost_basis: e.target.value })} className={inputClass} /></FormField>
                <FormField label="Current Price (UGX)"><input type="number" step="any" value={invForm.current_price} onChange={(e) => { const p = parseFloat(e.target.value) || 0; const q = parseFloat(invForm.quantity) || 0; setInvForm({ ...invForm, current_price: e.target.value, current_value: String(Math.round(p * q * 100) / 100) }); }} className={inputClass} /></FormField>
                <FormField label="Current Value (UGX)"><input type="number" step="any" value={invForm.current_value} onChange={(e) => setInvForm({ ...invForm, current_value: e.target.value })} className={inputClass} /></FormField>
              </div>
              <FormField label="Notes"><input value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} className={inputClass} /></FormField>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setShowInvestmentForm(false); setEditItem(null); }} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Saving..." : "Save"}</button></div>
            </form>
          </Modal>
        </div>
      )}

      {/* ═══ FINES ═══ */}
      {tab === "fines" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{fines.length} fines · Unpaid: {fmtUGX(fines.filter((f) => !f.is_paid).reduce((s, f) => s + f.amount, 0))}</span>
            <button onClick={() => setShowFineForm(true)} className={`${btnPrimary} px-3 flex items-center gap-2 text-xs`}><Plus size={14} />Record Fine</button>
          </div>
          <div className="card p-0 overflow-hidden">
            {fines.length === 0 ? <div className="px-5 py-8 text-center text-gray-500 text-sm">No fines recorded</div> : (
              <div className="overflow-x-auto"><div className="min-w-[600px]">{fines.map((f) => (
                <div key={f.id} className="grid grid-cols-5 items-center px-5 py-3 border-b border-surface-3 text-[13px] hover:bg-surface-2 transition-colors">
                  <div className="font-mono text-gray-400">{fmtDate(f.date)}</div>
                  <div>{f.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "—"}</div>
                  <div className="text-gray-400 text-xs truncate">{f.reason}</div>
                  <div className="text-right font-mono font-semibold text-amber-400">{fmtUGX(f.amount)}</div>
                  <div className="text-right"><button onClick={() => toggleFinePaid(f)} className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${f.is_paid ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>{f.is_paid ? "Paid" : "Unpaid"}</button></div>
                </div>
              ))}</div></div>
            )}
          </div>
          <Modal open={showFineForm} onClose={() => setShowFineForm(false)} title="Record Fine">
            <form onSubmit={saveFine} className="space-y-1">
              <FormField label="Member"><select value={fineForm.member_id} onChange={(e) => setFineForm({ ...fineForm, member_id: e.target.value })} required className={selectClass}><option value="">Select...</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</option>)}</select></FormField>
              <FormField label="Amount (UGX)"><input type="number" value={fineForm.amount} onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })} required min="1" className={inputClass} /></FormField>
              <FormField label="Reason"><select value={fineForm.reason} onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value })} required className={selectClass}><option value="">Select...</option><option value="Late payment">Late payment</option><option value="Missing a meeting">Missing a meeting</option><option value="Disrupting a meeting">Disrupting a meeting</option><option value="Late coming">Late coming</option><option value="Other">Other</option></select></FormField>
              <FormField label="Date"><input type="date" value={fineForm.date} onChange={(e) => setFineForm({ ...fineForm, date: e.target.value })} required className={inputClass} /></FormField>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowFineForm(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Recording..." : "Record"}</button></div>
            </form>
          </Modal>
        </div>
      )}

      {/* ═══ LOANS ═══ */}
      {tab === "loans" && (() => {
        const pendingLoans = loans.filter((l) => l.status === "pending");
        const activeLoans = loans.filter((l) => l.status === "active");
        const pastLoans = loans.filter((l) => ["paid", "rejected"].includes(l.status));
        const totalOutstanding = activeLoans.reduce((s, l) => s + (l.remaining || 0), 0);

        async function handleLoanAction(loanId, action, notes) {
          try {
            const data = await apiCall("/api/loans", "PUT", { id: loanId, action, notes });
            toast?.(data.message || `Loan ${action}ed`, "success");
            await refreshData();
          } catch (e) { toast?.(e.message, "error"); }
        }

        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                {pendingLoans.length} pending · {activeLoans.length} active · Outstanding: {fmtUGX(totalOutstanding)}
              </span>
            </div>

            {pendingLoans.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-semibold text-amber-400 mb-2">PENDING APPROVAL</div>
                <div className="space-y-3">
                  {pendingLoans.map((l) => (
                    <div key={l.id} className="card" style={{ borderColor: "rgba(217,119,6,0.3)" }}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm font-semibold">{l.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>
                          <div className="text-[11px] text-gray-500">{fmtDate(l.requested_at)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold font-mono">{fmtUGX(l.amount)}</div>
                          <div className="text-[11px] text-gray-500">{l.interest_rate}% flat interest</div>
                        </div>
                      </div>
                      {l.reason && <div className="text-xs text-gray-400 mb-3">Reason: {l.reason}</div>}
                      <div className="flex items-center gap-2 mb-3 text-xs">
                        <span className="text-gray-500">Approvals:</span>
                        {l.approved_by_1 ? (
                          <span className="px-2 py-0.5 rounded bg-green-900/20 text-green-400 font-semibold">{l.approver1?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "Admin 1"}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-surface-2 text-gray-500">Awaiting 1st</span>
                        )}
                        {l.approved_by_1 ? (
                          <span className="px-2 py-0.5 rounded bg-surface-2 text-gray-500">Awaiting 2nd</span>
                        ) : null}
                      </div>
                      {l.approved_by_1 === user.id ? (
                        <div className="text-xs text-amber-400 bg-amber-900/10 border border-amber-800/20 rounded-lg px-3 py-2">You already approved this loan. A different admin must provide the 2nd approval.</div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleLoanAction(l.id, "approve")} className={`${btnPrimary} px-4 text-xs`}>{l.approved_by_1 ? "Approve (2nd)" : "Approve (1st)"}</button>
                          <button onClick={() => setConfirm({ title: "Reject Loan", message: `Reject ${l.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}'s loan request for ${fmtUGX(l.amount)}?`, onConfirm: () => handleLoanAction(l.id, "reject"), confirmText: "Reject", danger: true })} className={`${btnSecondary} px-4 text-xs`}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeLoans.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-semibold text-green-400 mb-2">ACTIVE LOANS</div>
                <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[800px]">
                  <div className="grid grid-cols-7 items-center px-5 py-2.5 border-b-2 border-brand-700 text-[11px] text-gray-500 font-semibold">
                    <span>MEMBER</span><span className="text-right">AMOUNT</span><span className="text-right">TOTAL DUE</span><span className="text-right">PAID</span><span className="text-right">REMAINING</span><span className="text-right">DUE DATE</span><span className="text-right">STATUS</span>
                  </div>
                  {activeLoans.map((l) => {
                    const pct = l.calculated_total_due > 0 ? Math.min(100, Math.round((l.amount_paid / l.calculated_total_due) * 100)) : 0;
                    return (
                      <div key={l.id} className={`grid grid-cols-7 items-center px-5 py-3 border-b border-surface-3 text-[13px] ${l.is_overdue ? "bg-red-900/5" : ""}`}>
                        <div className="font-medium">{l.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>
                        <div className="text-right font-mono">{fmtShort(l.amount)}</div>
                        <div className="text-right font-mono">{fmtShort(l.calculated_total_due)}</div>
                        <div className="text-right font-mono text-green-400">{fmtShort(l.amount_paid)}</div>
                        <div className={`text-right font-mono ${l.is_overdue ? "text-red-400" : "text-amber-400"}`}>{fmtShort(l.remaining)}</div>
                        <div className="text-right text-xs">{l.due_date ? fmtDate(l.due_date) : "—"}</div>
                        <div className="text-right">{l.is_overdue ? <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-900/20 text-red-400">Overdue</span> : <span className="text-[11px] text-gray-500">{pct}% paid</span>}</div>
                      </div>
                    );
                  })}
                </div></div></div>
              </div>
            )}

            {pastLoans.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">HISTORY</div>
                <div className="card p-0 overflow-hidden">
                  {pastLoans.slice(0, 20).map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-5 py-2.5 border-b border-surface-3 text-[13px]">
                      <div><div className="font-medium">{l.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div><div className="text-[11px] text-gray-500">{fmtDate(l.requested_at)}</div></div>
                      <div className="font-mono">{fmtShort(l.amount)}</div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${l.status === "paid" ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>{l.status === "paid" ? "Paid" : "Rejected"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loans.length === 0 && <div className="card text-center py-8 text-gray-500 text-sm">No loan requests yet</div>}
          </div>
        );
      })()}

      {/* ═══ ANNOUNCEMENTS ═══ */}
      {tab === "announcements" && (() => {
        async function saveAnnouncement(e) {
          e.preventDefault();
          setSubmitting(true);
          try {
            await apiCall("/api/announcements", "POST", announceForm);
            toast?.("Announcement posted", "success");
            setShowAnnounceForm(false);
            setAnnounceForm({ title: "", body: "", pinned: false });
            await refreshData();
          } catch (e) { toast?.(e.message, "error"); }
          setSubmitting(false);
        }

        async function deleteAnnouncement(id) {
          try {
            await apiCall("/api/announcements", "DELETE", { id });
            toast?.("Announcement deleted", "success");
            await refreshData();
          } catch (e) { toast?.(e.message, "error"); }
        }

        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">{announcements.length} announcements</span>
              <button onClick={() => setShowAnnounceForm(true)} className={`${btnPrimary} px-3 flex items-center gap-2 text-xs`}><Plus size={14} />Post Announcement</button>
            </div>

            {announcements.length === 0 ? (
              <div className="card text-center py-8 text-gray-500 text-sm">No announcements yet</div>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="card" style={a.pinned ? { borderColor: "rgba(59,130,246,0.2)" } : {}}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{a.title}</span>
                          {a.pinned && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400 font-semibold">Pinned</span>}
                        </div>
                        <div className="text-xs text-gray-400">{a.body}</div>
                        <div className="text-[10px] text-gray-600 mt-2">
                          {a.author?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")} · {fmtDate(a.created_at)}
                        </div>
                      </div>
                      <button onClick={() => setConfirm({ title: "Delete Announcement", message: `Delete "${a.title}"? This cannot be undone.`, onConfirm: () => deleteAnnouncement(a.id), confirmText: "Delete", danger: true })} className="p-1.5 rounded hover:bg-red-900/20 text-gray-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Modal open={showAnnounceForm} onClose={() => setShowAnnounceForm(false)} title="Post Announcement">
              <form onSubmit={saveAnnouncement} className="space-y-1">
                <FormField label="Title"><input value={announceForm.title} onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })} required className={inputClass} placeholder="e.g. Monthly meeting reminder" /></FormField>
                <FormField label="Message"><textarea value={announceForm.body} onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })} required rows={4} className={inputClass} placeholder="Write your announcement..." /></FormField>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer py-1">
                  <input type="checkbox" checked={announceForm.pinned} onChange={(e) => setAnnounceForm({ ...announceForm, pinned: e.target.checked })} className="rounded" />
                  Pin this announcement (stays at top)
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAnnounceForm(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
                  <button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Posting..." : "Post"}</button>
                </div>
              </form>
            </Modal>
          </div>
        );
      })()}

      {/* ═══ AUDIT LOG ═══ */}
      {tab === "audit" && (() => {
        const ACTION_LABELS = {
          create: "Created", update: "Updated", delete: "Deleted", deactivate: "Deactivated",
          approve_first: "Approved (1/2)", activate: "Activated (2/2)", approve: "Approved",
          reject: "Rejected", complete: "Completed",
        };
        const ENTITY_STYLES = {
          contribution: "bg-green-900/20 text-green-400",
          loan: "bg-amber-900/20 text-amber-400",
          member: "bg-blue-900/20 text-blue-400",
          investment: "bg-purple-900/20 text-purple-400",
          fine: "bg-red-900/20 text-red-400",
          setting: "bg-gray-800/40 text-gray-400",
          withdrawal: "bg-cyan-900/20 text-cyan-400",
        };
        const filtered = auditFilter ? auditLogs.filter((l) => l.entity_type === auditFilter) : auditLogs;

        function formatDetails(log) {
          const d = log.details || {};
          if (log.entity_type === "contribution") {
            if (log.action === "create") return `${fmtUGX(d.amount)} ${d.type} on ${d.date}`;
            if (log.action === "update") {
              const changes = Object.entries(d.after || {}).map(([k, v]) => `${k}: ${d.before?.[k] ?? "—"} → ${v}`);
              return changes.join(", ");
            }
            if (log.action === "delete") return `${fmtUGX(d.deleted?.amount)} ${d.deleted?.type} on ${d.deleted?.date}`;
          }
          if (log.entity_type === "loan") return `${fmtUGX(d.amount)}${d.total_due ? ` (total due: ${fmtUGX(d.total_due)})` : ""}`;
          if (log.entity_type === "member") {
            if (log.action === "create") return `${d.name} (${d.email})`;
            if (log.action === "update") return Object.entries(d.updates || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
          }
          if (log.entity_type === "investment") {
            if (log.action === "create") return `${d.name} — ${fmtUGX(d.current_value)}`;
          }
          if (log.entity_type === "fine") return `${fmtUGX(d.amount)} — ${d.reason || ""}`;
          if (log.entity_type === "setting") {
            return Object.entries(d.after || {}).map(([k, v]) => `${k}: ${d.before?.[k] ?? "—"} → ${v}`).join(", ");
          }
          if (log.entity_type === "withdrawal") return `${fmtUGX(d.amount)}`;
          return JSON.stringify(d).slice(0, 80);
        }

        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">{filtered.length} log entries</span>
              <div className="flex gap-2">
                <select value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} className={`${selectClass} w-44 text-xs`}>
                  <option value="">All types</option>
                  <option value="contribution">Contributions</option>
                  <option value="loan">Loans</option>
                  <option value="member">Members</option>
                  <option value="investment">Investments</option>
                  <option value="fine">Fines</option>
                  <option value="setting">Settings</option>
                  <option value="withdrawal">Withdrawals</option>
                </select>
                <button onClick={() => { setAuditLogs([]); fetch("/api/audit?limit=200").then((r) => r.json()).then((d) => setAuditLogs(Array.isArray(d) ? d : [])); }} className={`${btnSecondary} px-3 text-xs`}>Refresh</button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card text-center py-8 text-gray-500 text-sm">No audit log entries yet</div>
            ) : (
              <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[700px]">
                <div className="grid grid-cols-[140px_120px_90px_80px_1fr] items-center px-5 py-2.5 border-b-2 border-brand-700 text-[11px] text-gray-500 font-semibold">
                  <span>DATE</span><span>ADMIN</span><span>ACTION</span><span>TYPE</span><span>DETAILS</span>
                </div>
                {filtered.slice(0, 200).map((log) => (
                  <div key={log.id} className="grid grid-cols-[140px_120px_90px_80px_1fr] items-center px-5 py-2.5 border-b border-surface-3 text-[13px]">
                    <div className="font-mono text-gray-500 text-xs">{new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="text-sm truncate">{log.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "—"}</div>
                    <div className="text-xs font-semibold">{ACTION_LABELS[log.action] || log.action}</div>
                    <div><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ENTITY_STYLES[log.entity_type] || "bg-surface-2 text-gray-400"}`}>{log.entity_type}</span></div>
                    <div className="text-xs text-gray-400 truncate">{formatDetails(log)}</div>
                  </div>
                ))}
              </div></div></div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
