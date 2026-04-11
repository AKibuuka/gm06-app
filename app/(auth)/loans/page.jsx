"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { Landmark, Plus, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Modal, { FormField, inputClass, btnPrimary, btnSecondary } from "@/components/Modal";
import { fmtUGX, fmtShort, fmtDate } from "@/lib/format";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

const STATUS_STYLES = {
  pending: { bg: "bg-amber-900/20 text-amber-400", label: "Pending Approval" },
  approved: { bg: "bg-blue-900/20 text-blue-400", label: "Approved (1/2)" },
  active: { bg: "bg-green-900/20 text-green-400", label: "Active" },
  paid: { bg: "bg-gray-800/40 text-gray-400", label: "Paid" },
  rejected: { bg: "bg-red-900/20 text-red-400", label: "Rejected" },
};

export default function LoansPage() {
  const user = useUser();
  const toast = useToast();
  const [loans, setLoans] = useState([]);
  const [meData, setMeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  useTitle("Loans");

  useEffect(() => {
    Promise.all([
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ]).then(([l, m]) => {
      setLoans(Array.isArray(l) ? l : []);
      setMeData(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeLoan = loans.find((l) => ["pending", "approved", "active"].includes(l.status));
  const pastLoans = loans.filter((l) => ["paid", "rejected"].includes(l.status));
  const maxPct = parseFloat(meData?.loan_settings?.max_loan_pct) || 80;
  const interestRate = parseFloat(meData?.loan_settings?.loan_interest_rate) || 10;
  const portfolioValue = meData?.valuation?.portfolio_value || 0;
  const maxAmount = Math.floor(portfolioValue * (maxPct / 100));

  async function handleRequest(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLoans([data, ...loans]);
      setShowRequest(false);
      setForm({ amount: "", reason: "" });
      toast?.("Loan request submitted", "success");
    } catch (e) { toast?.(e.message, "error"); }
    setSubmitting(false);
  }

  async function handleCancel(loanId) {
    try {
      const res = await fetch("/api/loans", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loanId, action: "cancel" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLoans(loans.map((l) => l.id === loanId ? { ...l, status: "rejected" } : l));
      toast?.("Loan request cancelled", "success");
    } catch (e) { toast?.(e.message, "error"); }
  }

  if (loading) return <SkeletonPage cards={4} rows={3} />;

  return (
    <div className="animate-in">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Loans</h1>
        <p className="text-sm text-gray-500 mt-1">Request and manage your loans</p>
      </div>

      {/* Loan Eligibility — shown when no active loan */}
      {!activeLoan && (
        <div className="card mb-6" style={{ borderColor: "rgba(15,118,110,0.2)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Landmark size={18} className="text-brand-500" />
            <span className="text-sm font-semibold">Loan Eligibility</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500">Your Portfolio</div>
              <div className="text-lg font-bold font-mono">{fmtUGX(portfolioValue)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Max Borrowable ({maxPct}%)</div>
              <div className="text-lg font-bold font-mono text-brand-500">{fmtUGX(maxAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Interest Rate</div>
              <div className="text-lg font-bold font-mono">{interestRate}%</div>
              <div className="text-[11px] text-gray-500">per quarter (3 months)</div>
            </div>
            <div className="flex items-end">
              {portfolioValue > 0 ? (
                <button onClick={() => setShowRequest(true)} className={`w-full ${btnPrimary} flex items-center justify-center gap-2`}>
                  <Plus size={14} /> Request a Loan
                </button>
              ) : (
                <div className="text-xs text-gray-500">No portfolio value yet</div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-500">Loans are quarterly (3 months). Requires 2 admin approvals. Repayments are auto-deducted from contributions. If not paid within 3 months, all contributions go to loan recovery.</p>
        </div>
      )}

      {/* Active Loan */}
      {activeLoan && (
        <div className="card mb-6" style={{ borderColor: activeLoan.is_overdue ? "rgba(239,68,68,0.4)" : activeLoan.status === "active" ? "rgba(15,118,110,0.3)" : "rgba(217,119,6,0.3)" }}>
          {activeLoan.is_overdue && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-xs rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
              <AlertTriangle size={14} /> This loan is overdue. All contributions will be applied to loan recovery until fully paid.
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark size={18} className={activeLoan.is_overdue ? "text-red-400" : "text-brand-500"} />
              <span className="text-sm font-semibold">
                {activeLoan.status === "active" ? "Active Loan" : "Loan Request"}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${activeLoan.is_overdue ? "bg-red-900/20 text-red-400" : STATUS_STYLES[activeLoan.status]?.bg}`}>
              {activeLoan.is_overdue ? "Overdue" : activeLoan.approved_by_1 && !activeLoan.approved_by_2 ? "Approved (1/2)" : STATUS_STYLES[activeLoan.status]?.label}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div><div className="text-xs text-gray-500">Loan Amount</div><div className="text-lg font-bold font-mono">{fmtUGX(activeLoan.amount)}</div></div>
            <div><div className="text-xs text-gray-500">Interest ({activeLoan.interest_rate}%)</div><div className="text-lg font-bold font-mono">{fmtUGX((activeLoan.calculated_total_due || activeLoan.total_due) - activeLoan.amount)}</div></div>
            <div><div className="text-xs text-gray-500">Total Due</div><div className="text-lg font-bold font-mono">{fmtUGX(activeLoan.calculated_total_due || activeLoan.total_due)}</div></div>
            <div><div className="text-xs text-gray-500">Remaining</div><div className={`text-lg font-bold font-mono ${activeLoan.is_overdue ? "text-red-400" : "text-amber-400"}`}>{fmtUGX(activeLoan.remaining || 0)}</div></div>
            {activeLoan.due_date && <div><div className="text-xs text-gray-500">Due Date</div><div className={`text-lg font-bold font-mono ${activeLoan.is_overdue ? "text-red-400" : ""}`}>{fmtDate(activeLoan.due_date)}</div></div>}
          </div>

          {activeLoan.status === "active" && activeLoan.calculated_total_due > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Repayment progress</span>
                <span>{Math.min(100, Math.round((activeLoan.amount_paid / activeLoan.calculated_total_due) * 100))}%</span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${activeLoan.is_overdue ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (activeLoan.amount_paid / activeLoan.calculated_total_due) * 100)}%` }} />
              </div>
            </div>
          )}

          {activeLoan.reason && <div className="text-xs text-gray-500 mb-2">Reason: <span className="text-gray-400">{activeLoan.reason}</span></div>}
          <div className="text-[11px] text-gray-500">Requested {fmtDate(activeLoan.requested_at)}{activeLoan.activated_at && ` · Activated ${fmtDate(activeLoan.activated_at)}`}</div>

          {activeLoan.status === "pending" && (
            <button onClick={() => handleCancel(activeLoan.id)} className={`mt-3 ${btnSecondary} text-xs px-3 py-1.5`}>Cancel Request</button>
          )}

          {/* Payment history */}
          {activeLoan.loan_payments?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-3">
              <div className="text-xs font-semibold mb-2">Payments ({activeLoan.loan_payments.length})</div>
              <div className="space-y-1.5">
                {activeLoan.loan_payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-gray-500">{fmtDate(p.created_at)}</span>
                    <span className="font-mono text-green-400">-{fmtShort(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past loans */}
      {pastLoans.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-3 text-sm font-semibold">Loan History</div>
          {pastLoans.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-5 py-3 border-b border-surface-3 text-[13px]">
              <div>
                <div className="font-mono">{fmtUGX(l.amount)}</div>
                <div className="text-[11px] text-gray-500">{fmtDate(l.requested_at)}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLES[l.status]?.bg}`}>{STATUS_STYLES[l.status]?.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Request Modal */}
      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="Request a Loan">
        <form onSubmit={handleRequest} className="space-y-1">
          <div className="bg-surface-2 rounded-lg p-4 mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Your portfolio</span><span className="font-mono">{fmtUGX(portfolioValue)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Max loan ({maxPct}%)</span><span className="font-mono text-brand-500">{fmtUGX(maxAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Interest rate</span><span className="font-mono">{interestRate}% (quarterly)</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Repayment</span><span className="font-mono">3 months</span></div>
            {form.amount > 0 && <div className="flex justify-between border-t border-surface-3 pt-1.5 mt-1"><span className="text-gray-500">You will repay</span><span className="font-mono text-white">{fmtUGX(parseFloat(form.amount) * (1 + interestRate / 100))}</span></div>}
          </div>
          <FormField label="Loan Amount (UGX)">
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min="1" max={maxAmount} className={inputClass} placeholder={`Max ${maxAmount.toLocaleString()}`} />
          </FormField>
          <FormField label="Reason">
            <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputClass} placeholder="Why do you need this loan?" />
          </FormField>
          <p className="text-[11px] text-gray-500">Requires 2 admin approvals. Must be repaid within 3 months. Repayments are auto-deducted from contributions. Overdue loans trigger full contribution recovery.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowRequest(false)} className={`flex-1 ${btnSecondary}`}>Cancel</button>
            <button type="submit" disabled={submitting} className={`flex-1 ${btnPrimary}`}>{submitting ? "Submitting..." : "Request Loan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
