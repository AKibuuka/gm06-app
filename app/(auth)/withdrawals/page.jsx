"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { ArrowUpRight, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import Modal, { FormField, inputClass, btnPrimary, btnSecondary } from "@/components/Modal";
import Confirm from "@/components/Confirm";
import { fmtUGX, fmtDate } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

const STATUS_STYLES = {
  pending: { bg: "bg-amber-900/20 text-amber-400", icon: Clock },
  approved: { bg: "bg-blue-900/20 text-blue-400", icon: CheckCircle2 },
  completed: { bg: "bg-green-900/20 text-green-400", icon: CheckCircle2 },
  rejected: { bg: "bg-red-900/20 text-red-400", icon: XCircle },
};

export default function WithdrawalsPage() {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  useTitle("Withdrawals");

  const [requests, setRequests] = useState([]);
  const [meData, setMeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/withdrawals").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ]).then(([w, m]) => {
      setRequests(Array.isArray(w) ? w : []);
      setMeData(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const portfolioValue = meData?.valuation?.portfolio_value || 0;
  const pendingRequest = requests.find((r) => r.status === "pending");
  const pastRequests = requests.filter((r) => r.status !== "pending");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests([data, ...requests]);
      setShowForm(false);
      setForm({ amount: "", reason: "" });
      toast?.("Withdrawal request submitted", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  async function handleAction(id, action) {
    try {
      const res = await fetch("/api/withdrawals", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(requests.map((r) => r.id === id ? data : r));
      toast?.(`Withdrawal ${action}${action === "complete" ? "d" : "ed"}`, "success");
    } catch (e) { toast?.(e.message, "error"); }
  }

  if (loading) return <SkeletonPage cards={2} rows={4} />;

  return (
    <div className="animate-in">
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} message={confirm?.message} onConfirm={confirm?.onConfirm || (() => {})} confirmText={confirm?.confirmText} danger={confirm?.danger} />

      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-sm text-gray-500 mt-1">{isAdmin ? "Manage withdrawal requests" : "Request to withdraw funds"}</p>
        </div>
        {!isAdmin && !pendingRequest && portfolioValue > 0 && (
          <button onClick={() => setShowForm(true)} className={`${btnPrimary} px-4 flex items-center gap-2`}>
            <Plus size={14} /> Request Withdrawal
          </button>
        )}
      </div>

      {/* Pending requests (admin sees all, member sees own) */}
      {requests.filter((r) => ["pending", "approved"].includes(r.status)).map((r) => {
        const StatusIcon = STATUS_STYLES[r.status]?.icon || Clock;
        return (
          <div key={r.id} className="card mb-4" style={{ borderColor: "rgba(217,119,6,0.3)" }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                {isAdmin && <div className="text-sm font-semibold mb-0.5">{r.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>}
                <div className="text-xs text-gray-500">{fmtDate(r.created_at)}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLES[r.status]?.bg}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
            </div>
            <div className="text-2xl font-bold font-mono mb-2">{fmtUGX(r.amount)}</div>
            {r.reason && <div className="text-xs text-gray-400 mb-3">Reason: {r.reason}</div>}
            {isAdmin && r.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(r.id, "approve")} className={`${btnPrimary} px-4 text-xs`}>Approve</button>
                <button onClick={() => setConfirm({ title: "Reject Withdrawal", message: `Reject withdrawal of ${fmtUGX(r.amount)}?`, onConfirm: () => handleAction(r.id, "reject"), confirmText: "Reject", danger: true })} className={`${btnSecondary} px-4 text-xs`}>Reject</button>
              </div>
            )}
            {isAdmin && r.status === "approved" && (
              <button onClick={() => setConfirm({ title: "Complete Withdrawal", message: `Mark ${fmtUGX(r.amount)} withdrawal as completed? This will record it as a withdrawal contribution.`, onConfirm: () => handleAction(r.id, "complete"), confirmText: "Complete" })} className={`${btnPrimary} px-4 text-xs`}>Mark as Completed</button>
            )}
          </div>
        );
      })}

      {requests.filter((r) => ["pending", "approved"].includes(r.status)).length === 0 && !isAdmin && (
        <div className="card text-center py-8 mb-4">
          <ArrowUpRight size={32} className="text-gray-600 mx-auto mb-3" />
          <div className="text-sm text-gray-400 mb-1">No pending withdrawals</div>
          <div className="text-xs text-gray-500">Your portfolio: <span className="font-mono text-white">{fmtUGX(portfolioValue)}</span></div>
        </div>
      )}

      {/* History */}
      {pastRequests.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-3 text-sm font-semibold">History</div>
          {pastRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3 border-b border-surface-3 text-[13px]">
              <div>
                {isAdmin && <div className="font-medium">{r.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>}
                <div className="font-mono">{fmtUGX(r.amount)}</div>
                <div className="text-[11px] text-gray-500">{fmtDate(r.created_at)}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLES[r.status]?.bg}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Request Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Request Withdrawal">
        <form onSubmit={handleSubmit} className="space-y-1">
          <div className="bg-surface-2 rounded-lg p-4 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Your portfolio</span><span className="font-mono">{fmtUGX(portfolioValue)}</span></div>
          </div>
          <FormField label="Amount (UGX)">
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="1" max={portfolioValue} className={inputClass} placeholder={`Max ${Math.floor(portfolioValue).toLocaleString()}`} />
          </FormField>
          <FormField label="Reason">
            <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputClass} placeholder="Why are you withdrawing?" />
          </FormField>
          <p className="text-[11px] text-gray-500">Requires admin approval. Once approved and completed, the amount is deducted from your portfolio.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
            <button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Submitting..." : "Request"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
