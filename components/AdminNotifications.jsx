"use client";
import { useState, useEffect } from "react";
import { Landmark, Wallet, AlertTriangle, X } from "lucide-react";
import { fmtUGX } from "@/lib/format";

export default function AdminNotifications() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only show once per session
    const key = "admin_notif_seen_" + new Date().toISOString().split("T")[0];
    if (sessionStorage.getItem(key)) { setLoading(false); return; }

    Promise.all([
      fetch("/api/loans?status=pending").then((r) => r.json()),
      fetch("/api/withdrawals").then((r) => r.json()),
    ]).then(([loans, withdrawals]) => {
      const pending = [];
      const pendingLoans = Array.isArray(loans) ? loans.filter((l) => l.status === "pending") : [];
      const pendingWithdrawals = Array.isArray(withdrawals) ? withdrawals.filter((w) => w.status === "pending") : [];
      const approvedWithdrawals = Array.isArray(withdrawals) ? withdrawals.filter((w) => w.status === "approved") : [];

      if (pendingLoans.length > 0) {
        pending.push({
          icon: Landmark,
          color: "text-amber-400",
          bg: "bg-amber-900/20",
          title: `${pendingLoans.length} loan request${pendingLoans.length > 1 ? "s" : ""} awaiting approval`,
          detail: pendingLoans.map((l) => `${l.members?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")} — ${fmtUGX(l.amount)}`).join(", "),
          href: "/admin",
        });
      }
      if (pendingWithdrawals.length > 0) {
        pending.push({
          icon: Wallet,
          color: "text-purple-400",
          bg: "bg-purple-900/20",
          title: `${pendingWithdrawals.length} withdrawal request${pendingWithdrawals.length > 1 ? "s" : ""} awaiting approval`,
          detail: pendingWithdrawals.map((w) => `${w.members?.name?.split(" ").map((n) => n[0] + n.slice(1).toLowerCase()).join(" ")} — ${fmtUGX(w.amount)}`).join(", "),
          href: "/withdrawals",
        });
      }
      if (approvedWithdrawals.length > 0) {
        pending.push({
          icon: Wallet,
          color: "text-cyan-400",
          bg: "bg-cyan-900/20",
          title: `${approvedWithdrawals.length} approved withdrawal${approvedWithdrawals.length > 1 ? "s" : ""} awaiting completion`,
          detail: approvedWithdrawals.map((w) => `${w.members?.name?.split(" ").map((n) => n[0] + n.slice(1).toLowerCase()).join(" ")} — ${fmtUGX(w.amount)}`).join(", "),
          href: "/withdrawals",
        });
      }

      setItems(pending);
      if (pending.length === 0) sessionStorage.setItem(key, "1");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function dismiss() {
    setDismissed(true);
    const key = "admin_notif_seen_" + new Date().toISOString().split("T")[0];
    sessionStorage.setItem(key, "1");
  }

  if (loading || dismissed || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl max-w-md w-full animate-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <span className="text-sm font-bold">Action Required</span>
          </div>
          <button onClick={dismiss} className="p-1 rounded hover:bg-surface-2 text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <a key={i} href={item.href} onClick={dismiss} className="block rounded-xl border border-surface-3 p-3 hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                    <Icon size={16} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-xs text-gray-500 truncate">{item.detail}</div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
        <div className="px-5 pb-5">
          <button onClick={dismiss} className="w-full bg-surface-2 hover:bg-surface-3 text-sm text-gray-300 font-medium py-2.5 rounded-lg transition-colors">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
