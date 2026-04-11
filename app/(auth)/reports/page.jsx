"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { FileText, Users, AlertTriangle, Download, Eye, Printer, FileSpreadsheet } from "lucide-react";
import { fmtUGX, fmtShort, ASSET_CLASS_LABELS } from "@/lib/format";

export default function ReportsPage() {
  const user = useUser();
  const toast = useToast();
  const [myData, setMyData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/members").then((r) => r.json()).then((d) => { setMembers(Array.isArray(d) ? d : []); setLoading(false); });
    } else {
      fetch("/api/me").then((r) => r.json()).then((d) => { setMyData(d); setLoading(false); });
    }
  }, [user]);

  function openStatement(memberId) {
    window.open(`/statements/${memberId}`, "_blank");
  }

  function openAllStatements() {
    members.forEach((m, i) => {
      setTimeout(() => window.open(`/statements/${m.id}`, "_blank"), i * 300);
    });
    toast?.(`Opening ${members.length} statements...`, "success");
  }

  function downloadCSV(type) {
    window.open(`/api/export?type=${type}`, "_blank");
    toast?.("Download started", "success");
  }

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading...</div>;

  // ── Member View ──
  if (user?.role !== "admin" && myData?.valuation) {
    const v = myData.valuation;
    const segments = (v.allocation || []).filter((a) => a.pct > 0);

    return (
      <div className="animate-in">
        <div className="mb-7">
          <h1 className="text-2xl font-bold">Your Statement</h1>
          <p className="text-sm text-gray-500 mt-1">Current portfolio statement</p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Statement preview */}
          <div className="bg-white text-gray-900 rounded-2xl p-8 mb-4">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-teal-700">GREEN MINDS 06</h2>
              <div className="text-[10px] tracking-[3px] text-gray-400">INVESTMENT CLUB</div>
            </div>
            <div className="bg-teal-50 rounded-xl p-5 mb-5">
              <div className="text-xs text-gray-500 mb-1">Portfolio Holder</div>
              <div className="text-base font-bold mb-3">{myData.member.name}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">Portfolio Value</span><br /><strong>{fmtUGX(v.portfolio_value)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Gain</span><br /><strong className="text-green-600">{fmtUGX(v.total_gain)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Invested</span><br /><strong>{fmtUGX(v.total_invested)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Return</span><br /><strong className="text-green-600">{v.return_pct}%</strong></div>
              </div>
            </div>
            <h3 className="text-sm font-bold mb-3">Portfolio Holdings</h3>
            <table className="w-full text-sm mb-4">
              <thead><tr className="border-b-2 border-teal-700"><th className="text-left py-1.5 px-2 text-teal-700 text-xs">Asset Class</th><th className="text-right py-1.5 px-2 text-teal-700 text-xs">Value (UGX)</th><th className="text-right py-1.5 px-2 text-teal-700 text-xs">%</th></tr></thead>
              <tbody>
                {segments.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs">{ASSET_CLASS_LABELS[a.asset_class] || a.asset_class}</td>
                    <td className="text-right py-1.5 px-2 font-mono text-xs">{Math.round(a.member_value).toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 text-xs">{a.pct}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-teal-700 font-bold"><td className="py-1.5 px-2 text-xs">Total</td><td className="text-right py-1.5 px-2 font-mono text-xs">{Math.round(v.portfolio_value).toLocaleString()}</td><td className="text-right py-1.5 px-2 text-xs">100%</td></tr>
              </tbody>
            </table>
            <div className="bg-teal-700 text-white rounded-lg py-2 px-4 text-center text-sm"><strong>Advance Contribution:</strong> {fmtUGX(v.advance_contribution)}</div>
          </div>

          <button onClick={() => openStatement(user.id)}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Printer size={16} /> Open Printable Statement
          </button>
          <p className="text-center text-[11px] text-gray-500 mt-2">Opens in a new tab — use Print → Save as PDF to download</p>
        </div>
      </div>
    );
  }

  // ── Admin View ──
  const arrearsMembers = members.filter((m) => (m.snapshot?.advance_contribution || 0) < 0);
  const totalArrears = arrearsMembers.reduce((s, m) => s + Math.abs(m.snapshot?.advance_contribution || 0), 0);

  return (
    <div className="animate-in">
      <div className="mb-7">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate statements and export data</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card flex flex-col">
          <Users size={28} className="text-gray-400 mb-4" />
          <h3 className="text-sm font-semibold mb-2">All Statements</h3>
          <p className="text-xs text-gray-500 flex-1 mb-5">Open printable statements for all {members.length} members in new tabs.</p>
          <button onClick={openAllStatements} className="w-full bg-brand-700 hover:bg-brand-800 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Printer size={14} /> Open All ({members.length})
          </button>
        </div>
        <div className="card flex flex-col">
          <FileSpreadsheet size={28} className="text-gray-400 mb-4" />
          <h3 className="text-sm font-semibold mb-2">Export Data</h3>
          <p className="text-xs text-gray-500 flex-1 mb-3">Download club data as CSV spreadsheets.</p>
          <div className="space-y-2">
            <button onClick={() => downloadCSV("members")} className="w-full bg-surface-2 hover:bg-surface-3 border border-surface-3 text-white py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"><Download size={12} />Members + Valuations</button>
            <button onClick={() => downloadCSV("contributions")} className="w-full bg-surface-2 hover:bg-surface-3 border border-surface-3 text-white py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"><Download size={12} />All Contributions</button>
            <button onClick={() => downloadCSV("portfolio")} className="w-full bg-surface-2 hover:bg-surface-3 border border-surface-3 text-white py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"><Download size={12} />Investments</button>
          </div>
        </div>
        <div className="card flex flex-col">
          <AlertTriangle size={28} className="text-gray-400 mb-4" />
          <h3 className="text-sm font-semibold mb-2">Arrears Report</h3>
          <p className="text-xs text-gray-500 flex-1 mb-5">{arrearsMembers.length} members owe {fmtUGX(totalArrears)} total.</p>
          <button onClick={() => downloadCSV("arrears")} className="w-full bg-brand-700 hover:bg-brand-800 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Download size={14} /> Download Arrears CSV
          </button>
        </div>
      </div>

      {/* Quick Individual Statements */}
      <div className="card">
        <div className="text-sm font-semibold mb-4">Individual Statements</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {members.map((m) => (
            <button key={m.id} onClick={() => openStatement(m.id)}
              className="text-left p-3 bg-surface-2 hover:bg-surface-3 border border-surface-3 hover:border-brand-700/40 rounded-lg transition-colors group">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-medium">{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{fmtUGX(m.snapshot?.portfolio_value || 0)}</div>
                </div>
                <Printer size={14} className="text-gray-600 group-hover:text-brand-500 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
