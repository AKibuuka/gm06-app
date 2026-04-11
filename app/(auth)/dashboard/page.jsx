"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { StatCard, DonutChart, Sparkline } from "@/components/Charts";
import { fmtUGX, fmtShort, ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "@/lib/format";
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp, AlertTriangle, Clock, Lock } from "lucide-react";
import { CLUB_SHORT } from "@/lib/constants";

function MemberDashboard({ hideHeader = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Clock size={18} className="animate-pulse text-gray-500 mr-2" /><span className="text-gray-500 text-sm">Loading your portfolio...</span></div>;
  if (error) return <div className="card border-red-800/30 text-red-400 text-sm">{error}</div>;
  if (!data?.valuation) return <div className="card text-gray-400 text-sm">No portfolio data available yet. The treasurer needs to run a monthly valuation first.</div>;

  const { member, valuation: v, history, contributions, unpaid_fines } = data;
  const segments = (v.allocation || []).filter((a) => a.pct > 0).map((a) => ({
    label: ASSET_CLASS_LABELS[a.asset_class] || a.asset_class, pct: a.pct, color: ASSET_CLASS_COLORS[a.asset_class] || "#666", value: a.member_value,
  }));
  const up = v.total_gain >= 0;

  // Compute growth metrics from history snapshots
  const now = new Date();
  const currentYear = now.getFullYear();
  const prevMonth = history.length >= 1 ? history[history.length - 1] : null;
  const janSnapshot = history.find((h) => h.date?.startsWith(`${currentYear}-01`)) || (history.length > 0 ? history.find((h) => h.date?.startsWith(`${currentYear}-`)) : null);

  const monthGain = prevMonth ? v.portfolio_value - prevMonth.portfolio_value : null;
  const monthPct = prevMonth && prevMonth.portfolio_value > 0 ? ((monthGain / prevMonth.portfolio_value) * 100).toFixed(1) : null;

  const ytdGain = janSnapshot ? v.portfolio_value - janSnapshot.portfolio_value : null;
  const ytdPct = janSnapshot && janSnapshot.portfolio_value > 0 ? ((ytdGain / janSnapshot.portfolio_value) * 100).toFixed(1) : null;

  return (
    <div className="animate-in">
      {!hideHeader && (
        <div className="mb-7">
          <h1 className="text-2xl font-bold">Welcome, {member.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live portfolio valuation
          </p>
        </div>
      )}

      {/* Hero */}
      <div className="card mb-6" style={{ borderColor: "rgba(15,118,110,0.3)" }}>
        <div className="text-xs text-gray-500 mb-2">Your Portfolio Value</div>
        <div className="text-3xl font-bold font-mono mb-1">{fmtUGX(v.portfolio_value)}</div>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className={`flex items-center gap-1 font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
            {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />} {up ? "+" : ""}{fmtUGX(v.total_gain)}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${up ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
            {up ? "+" : ""}{v.return_pct}%
          </span>
          <span className="text-gray-500">since inception</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">Monthly contribution: <span className="font-mono text-white">{fmtUGX(member.monthly_contribution)}</span></div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Invested" value={fmtUGX(v.total_invested)} />
        <StatCard
          label="This Month"
          value={monthGain !== null ? `${monthGain >= 0 ? "+" : ""}${fmtShort(monthGain)}` : "—"}
          sub={monthPct !== null ? `${monthPct >= 0 ? "+" : ""}${monthPct}%` : "No prior month"}
          color={monthGain === null ? "#6B7280" : monthGain >= 0 ? "#22C55E" : "#EF4444"}
        />
        <StatCard
          label="This Year"
          value={ytdGain !== null ? `${ytdGain >= 0 ? "+" : ""}${fmtShort(ytdGain)}` : "—"}
          sub={ytdPct !== null ? `${ytdPct >= 0 ? "+" : ""}${ytdPct}% YTD` : "No prior year data"}
          color={ytdGain === null ? "#6B7280" : ytdGain >= 0 ? "#22C55E" : "#EF4444"}
        />
        <StatCard label="Status" value={v.advance_contribution >= 0 ? "Current" : "Behind"} sub={`${v.advance_contribution >= 0 ? "+" : ""}${fmtShort(v.advance_contribution)}`} color={v.advance_contribution >= 0 ? "#22C55E" : "#EF4444"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 card">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold">Portfolio Over Time</div>
            {history.length > 0 && (
              <div className="text-[11px] text-gray-500">
                {new Date(history[0].date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — Present
              </div>
            )}
          </div>
          {history.length > 1 ? (
            <>
              <Sparkline data={history.map((h) => h.portfolio_value)} width={500} height={120} color="#14B8A6" />
              <div className="flex justify-between text-[10px] text-gray-600 mt-2 px-1">
                {history.filter((_, i) => i === 0 || i === history.length - 1 || i === Math.floor(history.length / 2)).map((h) => (
                  <span key={h.date}>{new Date(h.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-gray-500 text-sm py-8 text-center">Chart appears after the second monthly valuation</div>
          )}
        </div>
        <div className="lg:col-span-2 card">
          <div className="text-sm font-semibold mb-3">Your Allocation</div>
          <div className="flex items-center gap-4">
            <DonutChart segments={segments} size={110} />
            <div className="flex-1 space-y-1.5">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-400 flex-1 truncate">{s.label.replace(" (UAP)", "")}</span>
                  <span className="font-mono font-semibold">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-surface-3 text-xs text-gray-500">
            Ownership: <span className="font-mono text-white">{v.ownership_pct}%</span> of club
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm font-semibold mb-3">Your Holdings</div>
          {segments.map((s) => (
            <div key={s.label} className="flex justify-between items-center py-2 border-b border-surface-3 last:border-0">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded" style={{ background: s.color }} /><span className="text-sm">{s.label.replace(" (UAP)", "")}</span></div>
              <div className="text-right"><div className="text-sm font-mono font-semibold">{fmtUGX(s.value)}</div></div>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-sm font-bold"><span>Total</span><span className="font-mono">{fmtUGX(v.portfolio_value)}</span></div>
        </div>

        <div className="space-y-4">
          {unpaid_fines?.length > 0 && (
            <div className="card" style={{ borderColor: "rgba(217,119,6,0.3)", background: "rgba(120,53,15,0.1)" }}>
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2"><AlertTriangle size={16} /> Outstanding Fines</div>
              {unpaid_fines.map((f) => (
                <div key={f.id} className="flex justify-between text-sm py-1.5"><span className="text-gray-400">{f.reason}</span><span className="font-mono text-amber-400">{fmtUGX(f.amount)}</span></div>
              ))}
            </div>
          )}
          <div className="card">
            <div className="text-sm font-semibold mb-3">Recent Activity</div>
            {!contributions?.length ? <div className="text-gray-500 text-sm py-4 text-center">No contributions yet</div> : (
              <div className="divide-y divide-surface-3">
                {contributions.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.type === "deposit" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                        {c.type === "deposit" ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                      </div>
                      <div><div className="text-sm capitalize">{c.type}</div><div className="text-[11px] text-gray-500">{new Date(c.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
                    </div>
                    <div className={`text-sm font-mono font-semibold ${c.type === "deposit" ? "text-green-400" : "text-red-400"}`}>
                      {c.type === "deposit" ? "+" : "-"}{fmtShort(c.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [members, setMembers] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/portfolio").then((r) => r.json()),
    ]).then(([m, p]) => {
      setMembers(Array.isArray(m) ? m : []);
      setPortfolio(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Clock size={18} className="animate-pulse text-gray-500 mr-2" /><span className="text-gray-500 text-sm">Loading club data...</span></div>;

  const totalValue = portfolio?.totalValue || 0;
  const history = portfolio?.history || [];
  const summary = portfolio?.summary || {};
  const totalInvested = members.reduce((s, m) => s + (m.snapshot?.total_invested || 0), 0);
  const totalGain = totalValue - totalInvested;
  const returnPct = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : 0;
  const arrearsMembers = members.filter((m) => (m.snapshot?.advance_contribution || 0) < 0);
  const totalArrears = arrearsMembers.reduce((s, m) => s + m.snapshot.advance_contribution, 0);

  const segments = Object.entries(summary).map(([cls, data]) => ({
    label: ASSET_CLASS_LABELS[cls] || cls, pct: data.percentage || 0, color: ASSET_CLASS_COLORS[cls] || "#666", value: data.value,
  })).filter((s) => s.pct > 0);

  // Check if monthly contributions are due
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const latestSnapshotDate = members[0]?.snapshot_date;
  const snapshotMonth = latestSnapshotDate ? latestSnapshotDate.slice(0, 7) : null;
  const contributionsDue = !snapshotMonth || snapshotMonth < currentMonthStr;

  return (
    <div className="animate-in">
      <div className="mb-7"><h1 className="text-2xl font-bold">Club Dashboard</h1><p className="text-sm text-gray-500 mt-1">{CLUB_SHORT} Investment Club overview</p></div>

      {contributionsDue && (
        <div className="card mb-6 flex items-center gap-3" style={{ borderColor: "rgba(217,119,6,0.3)", background: "rgba(120,53,15,0.1)" }}>
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-400">Monthly contributions due</div>
            <div className="text-xs text-gray-400">Record member contributions for {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} and run a valuation.</div>
          </div>
          <a href="/contributions" className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">Record Now</a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Portfolio Value" value={fmtUGX(totalValue)} sub={`+${returnPct}% return`} color="#22C55E" />
        <StatCard label="Total Invested" value={fmtUGX(totalInvested)} sub={`${members.length} members`} color="#3B82F6" />
        <StatCard label="Total Gain" value={fmtUGX(totalGain)} sub="Since inception" color="#14B8A6" />
        <StatCard label="Arrears" value={fmtUGX(Math.abs(totalArrears))} sub={`${arrearsMembers.length} members behind`} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 card">
          <div className="text-sm font-semibold mb-4">Portfolio History</div>
          {history.length > 1 ? <Sparkline data={history.map((h) => h.total_value)} width={600} height={120} /> : <div className="text-gray-500 text-sm py-8 text-center">No history yet</div>}
        </div>
        <div className="lg:col-span-2 card">
          <div className="text-sm font-semibold mb-3">Asset Allocation</div>
          <div className="flex items-center gap-5">
            <DonutChart segments={segments} size={120} />
            <div className="flex-1 space-y-1.5">{segments.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs"><span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} /><span className="text-gray-400 flex-1 truncate">{s.label.replace(" (UAP)", "")}</span><span className="font-mono font-semibold">{s.pct.toFixed(1)}%</span></div>
            ))}</div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-3 flex justify-between items-center"><span className="text-sm font-semibold">All Members</span><span className="text-xs text-gray-500">{members.length} members</span></div>
        <div className="overflow-x-auto">
          {members.sort((a, b) => (b.snapshot?.portfolio_value || 0) - (a.snapshot?.portfolio_value || 0)).map((m) => {
            const s = m.snapshot;
            const ret = s && s.total_invested > 0 ? ((( s.portfolio_value - s.total_invested) / s.total_invested) * 100).toFixed(1) : 0;
            return (
              <div key={m.id} className="grid grid-cols-5 items-center px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]">
                <div><div className="font-medium">{m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</div><div className="text-[11px] text-gray-500">{m.monthly_contribution > 0 ? `${fmtShort(m.monthly_contribution)}/mo` : "No monthly"}</div></div>
                <div className="text-right font-mono">{fmtShort(s?.total_invested || 0)}</div>
                <div className="text-right font-mono font-semibold">{fmtShort(s?.portfolio_value || 0)}</div>
                <div className={`text-right font-semibold ${ret >= 0 ? "text-green-400" : "text-red-400"}`}>{ret >= 0 ? "+" : ""}{ret}%</div>
                <div className="text-right"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${(s?.advance_contribution || 0) >= 0 ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>{(s?.advance_contribution || 0) >= 0 ? "Current" : `−${fmtShort(Math.abs(s.advance_contribution))}`}</span></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useUser();
  if (!user) return null;

  if (user.role === "admin") {
    return (
      <>
        <AdminDashboard />
        <div className="mt-8 pt-8 border-t border-surface-3">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-400">My Portfolio</h2>
            <p className="text-xs text-gray-500">Your personal investment overview</p>
          </div>
          <MemberDashboard hideHeader />
        </div>
      </>
    );
  }

  return <MemberDashboard />;
}
