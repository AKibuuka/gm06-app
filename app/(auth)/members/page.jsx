"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useRouter } from "next/navigation";
import { Search, Download, X } from "lucide-react";
import { fmtUGX, fmtShort, fmtDate, ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "@/lib/format";
import { CLUB_NAME } from "@/lib/constants";
import { DonutChart } from "@/components/Charts";
import useTitle from "@/lib/useTitle";
import { SkeletonPage } from "@/components/Skeleton";

function StatementModal({ member, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member) return;
    fetch(`/api/statements?member_id=${member.id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [member]);

  if (!member) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white text-gray-900 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-auto p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading statement...</div>
        ) : data?.snapshot ? (() => {
          const now = new Date();
          const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          const nextMonthStart = now.getMonth() === 11 ? `${now.getFullYear() + 1}-01-01` : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;
          const thisMonthContribs = (data.contributions || []).filter((c) => c.type === "deposit" && c.date >= currentMonthStart && c.date < nextMonthStart);
          const thisMonthTotal = thisMonthContribs.reduce((s, c) => s + c.amount, 0);
          return (
          <>
            <div className="text-center mb-6">
              <div className="text-[11px] text-gray-400 tracking-wide">{fmtDate(data.date)}</div>
              <h2 className="text-lg font-bold text-teal-700 mt-1">{CLUB_NAME}</h2>
              <div className="text-[10px] tracking-[3px] text-gray-400">INVESTMENT CLUB</div>
            </div>

            <div className="bg-teal-50 rounded-xl p-5 mb-5">
              <div className="text-xs text-gray-500 mb-1">Portfolio Holder</div>
              <div className="text-base font-bold mb-3">{data.member.name}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">Portfolio Value</span><br /><strong>{fmtUGX(data.snapshot.portfolio_value)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Gain</span><br /><strong className="text-green-600">{fmtUGX(data.snapshot.portfolio_value - data.snapshot.total_invested)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Invested</span><br /><strong>{fmtUGX(data.snapshot.total_invested)}</strong></div>
                <div><span className="text-gray-500 text-xs">Total Return</span><br /><strong className="text-green-600">{data.snapshot.total_invested > 0 ? (((data.snapshot.portfolio_value - data.snapshot.total_invested) / data.snapshot.total_invested) * 100).toFixed(1) : 0}%</strong></div>
                <div><span className="text-gray-500 text-xs">Monthly Contribution</span><br /><strong>{fmtUGX(data.member.monthly_contribution)}</strong></div>
                <div><span className="text-gray-500 text-xs">Contributed This Month</span><br /><strong className={thisMonthTotal > 0 ? "text-green-600" : "text-red-600"}>{thisMonthTotal > 0 ? fmtUGX(thisMonthTotal) : "Not yet paid"}</strong></div>
              </div>
            </div>

            <h3 className="text-sm font-bold mb-3">Portfolio Holdings</h3>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b-2 border-teal-700">
                  <th className="text-left py-1.5 px-2 text-teal-700 text-xs">Asset Class</th>
                  <th className="text-right py-1.5 px-2 text-teal-700 text-xs">Value (UGX)</th>
                  <th className="text-right py-1.5 px-2 text-teal-700 text-xs">%</th>
                </tr>
              </thead>
              <tbody>
                {(data.allocation || []).map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs">{a.asset}</td>
                    <td className="text-right py-1.5 px-2 font-mono text-xs">{a.value > 0 ? Math.round(a.value).toLocaleString() : "-"}</td>
                    <td className="text-right py-1.5 px-2 text-xs">{a.pct > 0 ? `${a.pct}%` : "0.0%"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-teal-700 font-bold">
                  <td className="py-1.5 px-2 text-xs">Sum</td>
                  <td className="text-right py-1.5 px-2 font-mono text-xs">{Math.round(data.snapshot.portfolio_value).toLocaleString()}</td>
                  <td className="text-right py-1.5 px-2 text-xs">100%</td>
                </tr>
              </tbody>
            </table>

            <div className="bg-teal-700 text-white rounded-lg py-2 px-4 text-center text-sm">
              <strong>Advance Contribution:</strong> {fmtUGX(data.snapshot.advance_contribution)}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-3">Valuations may include unrealised profits/losses.</p>
            <div className="mt-4 pt-3 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-400">Generated on {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} at {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-[10px] text-gray-400 mt-1">For any queries, contact the Treasurer at greenminds06investmentclub@gmail.com</p>
            </div>
          </>
          );
        })() : (
          <div className="py-16 text-center text-gray-400">No statement data available for this period.</div>
        )}
      </div>
    </div>
  );
}

export default function MembersPage() {
  const user = useUser();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("value");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  useTitle("Members");

  // Members (non-admin) see only their own data via /dashboard
  useEffect(() => {
    if (user?.role !== "admin") { router.push("/dashboard"); return; }
    fetch("/api/members").then((r) => r.json()).then((d) => { setMembers(Array.isArray(d) ? d : []); setLoading(false); });
  }, [user, router]);

  if (user?.role !== "admin") return null;

  const filtered = members
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const sa = a.snapshot, sb = b.snapshot;
      if (sortBy === "value") return (sb?.portfolio_value || 0) - (sa?.portfolio_value || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "arrears") return (sa?.advance_contribution || 0) - (sb?.advance_contribution || 0);
      return 0;
    });

  if (loading) return <SkeletonPage cards={0} rows={8} />;

  return (
    <div className="animate-in">
      <StatementModal member={selected} onClose={() => setSelected(null)} />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} active members</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-white outline-none focus:border-brand-700 w-48" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer">
            <option value="value">By Value</option>
            <option value="name">By Name</option>
            <option value="arrears">By Arrears</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[700px]">
        <div className="grid grid-cols-6 items-center px-5 py-3 border-b-2 border-brand-700 text-[11px] text-gray-500 font-semibold tracking-wide">
          <span>MEMBER</span><span className="text-right">INVESTED</span><span className="text-right">VALUE</span><span className="text-right">RETURN</span><span className="text-right">STATUS</span><span className="text-center">STATEMENT</span>
        </div>
        {filtered.map((m) => {
          const s = m.snapshot;
          const ret = s && s.total_invested > 0 ? (((s.portfolio_value - s.total_invested) / s.total_invested) * 100).toFixed(1) : 0;
          return (
            <div key={m.id} className="grid grid-cols-6 items-center px-5 py-3.5 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]">
              <div>
                <div className="font-medium">{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div>
                <div className="text-[11px] text-gray-500">{m.monthly_contribution > 0 ? `${fmtShort(m.monthly_contribution)}/mo` : "No monthly"}</div>
              </div>
              <div className="text-right font-mono">{fmtShort(s?.total_invested || 0)}</div>
              <div className="text-right font-mono font-semibold">{fmtShort(s?.portfolio_value || 0)}</div>
              <div className={`text-right font-semibold ${ret >= 0 ? "text-green-400" : "text-red-400"}`}>{ret >= 0 ? "+" : ""}{ret}%</div>
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${(s?.advance_contribution || 0) >= 0 ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                  {(s?.advance_contribution || 0) >= 0 ? "Current" : `−${fmtShort(Math.abs(s.advance_contribution))}`}
                </span>
              </div>
              <div className="text-center">
                <button onClick={() => setSelected(m)} className="bg-brand-700 hover:bg-brand-800 text-white text-[11px] px-3 py-1 rounded-md transition-colors">View</button>
              </div>
            </div>
          );
        })}
      </div></div></div>
    </div>
  );
}
