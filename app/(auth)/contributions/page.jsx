"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { Plus, DollarSign, ArrowDown, ArrowUp, AlertTriangle, Pencil, Paperclip, X } from "lucide-react";
import Modal, { FormField, inputClass, selectClass, btnPrimary, btnSecondary } from "@/components/Modal";
import { fmtUGX, fmtShort, fmtDate } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

const TYPE_STYLES = {
  deposit: { bg: "bg-green-900/20 text-green-400", icon: ArrowDown },
  fine: { bg: "bg-amber-900/20 text-amber-400", icon: AlertTriangle },
  expense: { bg: "bg-red-900/20 text-red-400", icon: ArrowUp },
  withdrawal: { bg: "bg-purple-900/20 text-purple-400", icon: ArrowUp },
};

export default function ContributionsPage() {
  const user = useUser();
  const toast = useToast();
  useTitle("Contributions");
  const isAdmin = user?.role === "admin";

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [form, setForm] = useState({ member_id: "", amount: "", type: "deposit", description: "", bank_ref: "", date: new Date().toISOString().split("T")[0] });
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [batchAmounts, setBatchAmounts] = useState({});
  const [batchRefs, setBatchRefs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", amount: "", type: "deposit", description: "", bank_ref: "", date: "", receipt_url: "" });
  const [receiptFile, setReceiptFile] = useState(null);
  const [editReceiptFile, setEditReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetches = [fetch("/api/contributions").then((r) => r.json())];
    if (isAdmin) fetches.push(fetch("/api/members").then((r) => r.json()));
    Promise.all(fetches).then(([c, m]) => {
      setContributions(Array.isArray(c) ? c : []);
      if (m) setMembers(Array.isArray(m) ? m : []);
      setLoading(false);
    });
  }, [isAdmin]);

  const filtered = contributions.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    if (filterMember && c.member_id !== filterMember) return false;
    return true;
  });

  const totalDeposits = contributions.filter((c) => c.type === "deposit").reduce((s, c) => s + c.amount, 0);
  const totalFines = contributions.filter((c) => c.type === "fine").reduce((s, c) => s + c.amount, 0);

  async function uploadReceipt(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    const { url } = await res.json();
    return url;
  }

  async function handleAdd(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      let receipt_url = null;
      if (receiptFile) {
        setUploading(true);
        receipt_url = await uploadReceipt(receiptFile);
        setUploading(false);
      }
      const res = await fetch("/api/contributions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, receipt_url }) });
      if (res.ok) {
        const data = await res.json();
        const recordedAmount = parseFloat(form.amount);
        setContributions([data, ...contributions]);
        setShowAdd(false);
        setForm({ member_id: "", amount: "", type: "deposit", description: "", bank_ref: "", date: new Date().toISOString().split("T")[0] });
        setReceiptFile(null);
        const msg = data.loan_deduction
          ? `Recorded ${fmtUGX(recordedAmount)} — ${fmtUGX(data.loan_deduction.amount_applied)} applied to loan, ${fmtUGX(data.loan_deduction.excess)} to portfolio`
          : `Contribution of ${fmtUGX(data.amount)} recorded`;
        toast?.(msg, "success");
      } else { const err = await res.json(); toast?.(err.error, "error"); }
    } catch (err) { toast?.(err.message, "error"); setUploading(false); }
    setSubmitting(false);
  }

  async function handleBatch(e) {
    e.preventDefault(); setSubmitting(true);
    const entries = Object.entries(batchAmounts).filter(([, a]) => a > 0);
    const results = [];
    let failures = 0;
    for (const [member_id, amount] of entries) {
      const res = await fetch("/api/contributions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id, amount, type: "deposit", description: `Monthly contribution`, bank_ref: batchRefs[member_id] || null, date: batchDate }),
      });
      if (res.ok) results.push(await res.json());
      else { failures++; const err = await res.json(); toast?.(`${err.error}`, "error"); }
    }
    setContributions([...results, ...contributions]);
    setShowBatch(false); setBatchAmounts({}); setBatchRefs({}); setSubmitting(false);

    // Show receipt summary
    const totalRecorded = results.reduce((s, r) => s + (r.amount || 0), 0);
    const loanDeductions = results.filter((r) => r.loan_deduction);
    const loanTotal = loanDeductions.reduce((s, r) => s + (r.loan_deduction?.amount_applied || 0), 0);
    let msg = `Recorded ${results.length}/${entries.length} contributions totaling ${fmtUGX(totalRecorded + loanTotal)}`;
    if (failures > 0) msg += ` (${failures} failed)`;
    if (loanDeductions.length > 0) msg += `. ${loanDeductions.length} had loan deductions (${fmtUGX(loanTotal)} applied to loans)`;
    toast?.(msg, failures > 0 ? "error" : "success");
  }

  async function handleEdit(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      let receipt_url = editForm.receipt_url;
      if (editReceiptFile) {
        setUploading(true);
        receipt_url = await uploadReceipt(editReceiptFile);
        setUploading(false);
      }
      const res = await fetch("/api/contributions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editForm, receipt_url }) });
      if (res.ok) {
        const data = await res.json();
        setContributions(contributions.map((c) => c.id === data.id ? data : c));
        setShowEdit(false);
        setEditReceiptFile(null);
        toast?.("Contribution updated", "success");
      } else { const err = await res.json(); toast?.(err.error, "error"); }
    } catch (err) { toast?.(err.message, "error"); setUploading(false); }
    setSubmitting(false);
  }

  function openEdit(c) {
    setEditForm({ id: c.id, amount: c.amount, type: c.type, description: c.description || "", bank_ref: c.bank_ref || "", date: c.date, receipt_url: c.receipt_url || "" });
    setEditReceiptFile(null);
    setShowEdit(true);
  }

  if (loading) return <SkeletonPage cards={3} rows={6} />;

  return (
    <div className="animate-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "All Contributions" : "My Contributions"}</h1>
          <p className="text-sm text-gray-500 mt-1">{contributions.length} records</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setShowBatch(true)} className={`${btnSecondary} px-4 flex items-center gap-2`}><DollarSign size={14} />Record Monthly</button>
            <button onClick={() => setShowAdd(true)} className={`${btnPrimary} px-4 flex items-center gap-2`}><Plus size={14} />Add Single</button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="text-xs text-gray-500 mb-1">Total Deposits</div><div className="text-lg font-bold font-mono text-green-400">{fmtUGX(totalDeposits)}</div></div>
        <div className="card"><div className="text-xs text-gray-500 mb-1">Total Fines</div><div className="text-lg font-bold font-mono text-amber-400">{fmtUGX(totalFines)}</div></div>
        <div className="card"><div className="text-xs text-gray-500 mb-1">Net Contributions</div><div className="text-lg font-bold font-mono">{fmtUGX(totalDeposits - contributions.filter(c => c.type === "withdrawal").reduce((s,c) => s + c.amount, 0))}</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={`${selectClass} w-full sm:w-40`}>
          <option value="">All types</option>
          <option value="deposit">Deposits</option><option value="fine">Fines</option><option value="expense">Expenses</option><option value="withdrawal">Withdrawals</option>
        </select>
        {isAdmin && (
          <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} className={`${selectClass} w-full sm:w-56`}>
            <option value="">All members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden"><div className="overflow-x-auto">
        <div className={`grid ${isAdmin ? "grid-cols-4 sm:grid-cols-[1fr_1fr_80px_1fr_1fr_1fr_40px]" : "grid-cols-3 sm:grid-cols-5"} items-center px-4 sm:px-5 py-3 border-b-2 border-brand-700 text-[11px] text-gray-500 font-semibold tracking-wide`}>
          <span>DATE</span>{isAdmin && <span>MEMBER</span>}<span>TYPE</span><span className="text-right">AMOUNT</span><span className="hidden sm:block">BANK REF</span><span className="hidden sm:block">DESCRIPTION</span>{isAdmin && <span className="hidden sm:block"></span>}
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">No contributions found</div>
        ) : (
          filtered.slice(0, 100).map((c) => {
            const style = TYPE_STYLES[c.type] || TYPE_STYLES.deposit;
            const Icon = style.icon;
            return (
              <div key={c.id} className={`grid ${isAdmin ? "grid-cols-4 sm:grid-cols-[1fr_1fr_80px_1fr_1fr_1fr_40px]" : "grid-cols-3 sm:grid-cols-5"} items-center px-4 sm:px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]`}>
                <div className="font-mono text-gray-400 text-xs">{fmtDate(c.date)}</div>
                {isAdmin && <div className="font-medium truncate">{c.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ") || "—"}</div>}
                <div><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${style.bg}`}><Icon size={10} />{c.type}</span></div>
                <div className="text-right font-mono font-semibold">{fmtUGX(c.amount)}</div>
                <div className="hidden sm:block text-gray-500 text-xs font-mono truncate">{c.bank_ref || "—"}</div>
                <div className="hidden sm:block text-gray-500 text-xs truncate flex items-center gap-1">
                  {c.receipt_url && <a href={c.receipt_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-500 hover:text-brand-400"><Paperclip size={11} /></a>}
                  {c.description || "—"}
                </div>
                {isAdmin && <div className="hidden sm:block"><button onClick={() => openEdit(c)} className="p-2 sm:p-1 rounded hover:bg-surface-3 text-gray-500 hover:text-white"><Pencil size={12} /></button></div>}
              </div>
            );
          })
        )}
      </div></div>

      {/* Add Single Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Contribution">
        <form onSubmit={handleAdd} className="space-y-1">
          <FormField label="Member"><select value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} required className={selectClass}><option value="">Select...</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</option>)}</select></FormField>
          <FormField label="Type"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={selectClass}><option value="deposit">Deposit</option><option value="expense">Expense</option><option value="withdrawal">Withdrawal</option></select></FormField>
          <FormField label="Amount (UGX)"><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="1" className={inputClass} /></FormField>
          <FormField label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required max={new Date().toISOString().split("T")[0]} className={inputClass} /></FormField>
          <FormField label="Bank Reference"><input type="text" value={form.bank_ref} onChange={(e) => setForm({ ...form, bank_ref: e.target.value })} className={inputClass} placeholder="e.g. TXN-20260401-001" /></FormField>
          <FormField label="Description"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="e.g. April 2026 deposit" /></FormField>
          <FormField label="Receipt (optional)">
            {receiptFile ? (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Paperclip size={14} className="text-brand-500" />
                <span className="truncate flex-1">{receiptFile.name}</span>
                <button type="button" onClick={() => setReceiptFile(null)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
              </div>
            ) : (
              <label className={`${inputClass} cursor-pointer flex items-center gap-2 text-gray-500`}>
                <Paperclip size={14} />
                <span>Attach receipt image or PDF</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </FormField>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowAdd(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting || uploading} className={`flex-1 ${btnPrimary}`}>{uploading ? "Uploading..." : submitting ? "Saving..." : "Record"}</button></div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Contribution">
        <form onSubmit={handleEdit} className="space-y-1">
          <FormField label="Type"><select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className={selectClass}><option value="deposit">Deposit</option><option value="expense">Expense</option><option value="withdrawal">Withdrawal</option><option value="fine">Fine</option></select></FormField>
          <FormField label="Amount (UGX)"><input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} required min="0" className={inputClass} /></FormField>
          <FormField label="Date"><input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} required max={new Date().toISOString().split("T")[0]} className={inputClass} /></FormField>
          <FormField label="Bank Reference"><input type="text" value={editForm.bank_ref} onChange={(e) => setEditForm({ ...editForm, bank_ref: e.target.value })} className={inputClass} /></FormField>
          <FormField label="Description"><input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={inputClass} /></FormField>
          <FormField label="Receipt">
            {editForm.receipt_url && !editReceiptFile ? (
              <div className="flex items-center gap-2 text-sm">
                <Paperclip size={14} className="text-green-400" />
                <a href={editForm.receipt_url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline truncate flex-1">View receipt</a>
                <button type="button" onClick={() => setEditForm({ ...editForm, receipt_url: "" })} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
              </div>
            ) : editReceiptFile ? (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Paperclip size={14} className="text-brand-500" />
                <span className="truncate flex-1">{editReceiptFile.name}</span>
                <button type="button" onClick={() => setEditReceiptFile(null)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
              </div>
            ) : (
              <label className={`${inputClass} cursor-pointer flex items-center gap-2 text-gray-500`}>
                <Paperclip size={14} />
                <span>Attach receipt image or PDF</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </FormField>
          <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowEdit(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting || uploading} className={`flex-1 ${btnPrimary}`}>{uploading ? "Uploading..." : submitting ? "Saving..." : "Save Changes"}</button></div>
        </form>
      </Modal>

      {/* Batch Modal */}
      <Modal open={showBatch} onClose={() => setShowBatch(false)} title="Record Monthly Contributions" wide>
        <form onSubmit={handleBatch}>
          <FormField label="Date"><input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} required className={inputClass} /></FormField>
          <div className="text-xs text-gray-500 mb-3">Enter each member's contribution (leave 0 to skip)</div>
          <div className="space-y-2 max-h-80 overflow-auto mb-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-36 text-sm truncate">{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>
                <input type="number" min="0" value={batchAmounts[m.id] || ""} onChange={(e) => setBatchAmounts({ ...batchAmounts, [m.id]: parseFloat(e.target.value) || 0 })} className={`w-32 ${inputClass}`} placeholder={m.monthly_contribution > 0 ? `${m.monthly_contribution.toLocaleString()}` : "0"} />
                <input type="text" value={batchRefs[m.id] || ""} onChange={(e) => setBatchRefs({ ...batchRefs, [m.id]: e.target.value })} className={`flex-1 ${inputClass}`} placeholder="Bank ref" />
                {m.monthly_contribution > 0 && <button type="button" onClick={() => setBatchAmounts({ ...batchAmounts, [m.id]: m.monthly_contribution })} className="text-[10px] text-brand-500 hover:text-brand-400 whitespace-nowrap">Default</button>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Total: <strong className="text-white font-mono">{fmtUGX(Object.values(batchAmounts).reduce((s, a) => s + (a || 0), 0))}</strong></span>
            <button type="button" onClick={() => { const auto = {}; members.forEach(m => { if (m.monthly_contribution > 0) auto[m.id] = m.monthly_contribution; }); setBatchAmounts(auto); }} className="text-xs text-brand-500 hover:text-brand-400">Auto-fill defaults</button>
          </div>
          <div className="flex gap-3"><button type="button" onClick={() => setShowBatch(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button><button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Recording..." : "Record All"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
