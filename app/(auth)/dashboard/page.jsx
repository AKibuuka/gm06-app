"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { StatCard, DonutChart, Sparkline } from "@/components/Charts";
import { fmtUGX, fmtShort, fmtDate, ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "@/lib/format";
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp, AlertTriangle, Clock, Landmark, Wallet, BarChart3, MessageSquare, DollarSign, PieChart } from "lucide-react";
import { CLUB_SHORT } from "@/lib/constants";
import useTitle from "@/lib/useTitle";
import Avatar, { titleCase } from "@/components/Avatar";
import { SkeletonPage } from "@/components/Skeleton";
import AdminNotifications from "@/components/AdminNotifications";

function MemberDashboard({ hideHeader = false }) {
  useTitle("Dashboard");
  const [data, setData] = useState(null);
  const [clubActivity, setClubActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("personal");

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); }),
      fetch("/api/activity").then((r) => r.json()).catch(() => []),
    ]).then(([me, act]) => {
      setData(me);
      setClubActivity(Array.isArray(act) ? act : []);
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonPage cards={4} rows={3} />;
  if (error) return <div className="card border-red-800/30 text-red-400 text-sm">{error}</div>;
  if (!data?.valuation) return (
    <div className="animate-in">
      {!hideHeader && <div className="mb-7"><h1 className="text-2xl font-bold">Welcome to {CLUB_SHORT}</h1></div>}
      <div className="card text-center py-12">
        <Wallet size={40} className="text-gray-600 mx-auto mb-4" />
        <div className="text-sm font-semibold text-gray-400 mb-2">Your portfolio is being set up</div>
        <div className="text-xs text-gray-500 max-w-sm mx-auto">The treasurer needs to record contributions and run the first monthly valuation. Once that's done, you'll see your portfolio value, holdings, and growth here.</div>
      </div>
    </div>
  );

  const { member, valuation: v, history, contributions, unpaid_fines, club_history, active_loan, contribution_status, announcements, gains, club_gains } = data;
  const segments = ((v && v.allocation) || []).filter((a) => a.pct > 0).map((a) => ({
    label: ASSET_CLASS_LABELS[a.asset_class] || a.asset_class, pct: a.pct, color: ASSET_CLASS_COLORS[a.asset_class] || "#666", value: a.member_value, clubValue: a.club_value,
  }));
  const up = v.total_gain >= 0;

  // Growth metrics
  const now = new Date();
  const currentYear = now.getFullYear();
  const safeHistory = history || [];
  const prevMonth = safeHistory.length >= 1 ? safeHistory[safeHistory.length - 1] : null;
  const janSnapshot = safeHistory.find((h) => h.date?.startsWith(`${currentYear}-01`)) || (safeHistory.length > 0 ? safeHistory.find((h) => h.date?.startsWith(`${currentYear}-`)) : null);
  const monthGain = prevMonth ? v.portfolio_value - prevMonth.portfolio_value : null;
  const monthPct = prevMonth && prevMonth.portfolio_value > 0 ? ((monthGain / prevMonth.portfolio_value) * 100).toFixed(1) : null;
  const ytdGain = janSnapshot ? v.portfolio_value - janSnapshot.portfolio_value : null;
  const ytdPct = janSnapshot && janSnapshot.portfolio_value > 0 ? ((ytdGain / janSnapshot.portfolio_value) * 100).toFixed(1) : null;

  // Club data
  const clubHist = club_history || [];
  const clubTotal = v.club_total || 0;
  const clubSegments = segments.map((s) => ({ ...s, value: s.clubValue, pct: s.pct }));

  return (
    <div className="animate-in">
      {!hideHeader && (
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Welcome, {member.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</h1>
          <p className="text-sm text-gray-500 mt-1">Your investment overview</p>
        </div>
      )}

      {/* Tab Toggle */}
      <div className="flex gap-1 mb-6 bg-surface-1 border border-surface-3 rounded-xl p-1 w-fit">
        {[{ id: "personal", label: "My Portfolio", icon: Wallet }, { id: "club", label: "Club Overview", icon: BarChart3 }].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.id ? "bg-brand-700 text-white" : "text-gray-400 hover:text-white"}`}>
              <Icon size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {contribution_status?.is_due && (
        <div className="card mb-5" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(127,29,29,0.1)" }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-400">Contribution Due</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Total outstanding: <span className="text-red-400 font-mono font-semibold">{fmtUGX(contribution_status.total_arrears)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 pl-[30px]">
            {contribution_status.previous_arrears > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">
                  Past arrears <span className="text-gray-500">({contribution_status.months_behind} month{contribution_status.months_behind !== 1 ? "s" : ""} missed)</span>
                </span>
                <span className="font-mono text-red-400">{fmtUGX(contribution_status.previous_arrears)}</span>
              </div>
            )}
            {contribution_status.current_month_remaining > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">
                  This month <span className="text-gray-500">({fmtUGX(contribution_status.paid_this_month)} of {fmtUGX(contribution_status.required)} paid)</span>
                </span>
                <span className="font-mono text-amber-400">{fmtUGX(contribution_status.current_month_remaining)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Announcements */}
      {announcements?.length > 0 && tab === "personal" && (
        <div className="space-y-2 mb-5">
          {announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="card py-3" style={a.pinned ? { borderColor: "rgba(59,130,246,0.2)" } : {}}>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded bg-brand-700/20 flex items-center justify-center shrink-0 mt-0.5"><MessageSquare size={12} className="text-brand-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{a.title}</span>
                    {a.pinned && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400 font-semibold">Pinned</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{a.body}</div>
                  <div className="text-[10px] text-gray-600 mt-1">{a.author?.name?.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")} · {new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ PERSONAL TAB ═══ */}
      {tab === "personal" && (
        <div>
          {/* Hero */}
          <div className="card mb-5" style={{ borderColor: "rgba(15,118,110,0.3)" }}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">Your Portfolio Value</div>
                <div className="text-3xl font-bold font-mono">{fmtUGX(v.portfolio_value)}</div>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 font-semibold text-sm ${up ? "text-green-400" : "text-red-400"}`}>
                  {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />} {up ? "+" : ""}{fmtUGX(v.total_gain)}
                </div>
                <div className={`text-xs font-bold ${up ? "text-green-400" : "text-red-400"}`}>{up ? "+" : ""}{v.return_pct}% all-time</div>
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>Monthly: <span className="font-mono text-white">{fmtUGX(member.monthly_contribution)}</span></span>
              <span>Ownership: <span className="font-mono text-white">{v.ownership_pct}%</span></span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label="Total Invested" value={fmtUGX(v.total_invested)} />
            <StatCard label="Today" value={gains?.daily ? `${gains.daily.gain >= 0 ? "+" : ""}${fmtShort(gains.daily.gain)}` : "—"} sub={gains?.daily ? `${gains.daily.pct >= 0 ? "+" : ""}${gains.daily.pct}%` : "No price data"} color={!gains?.daily ? "#6B7280" : gains.daily.gain >= 0 ? "#22C55E" : "#EF4444"} />
            <StatCard label="This Week" value={gains?.weekly ? `${gains.weekly.gain >= 0 ? "+" : ""}${fmtShort(gains.weekly.gain)}` : "—"} sub={gains?.weekly ? `${gains.weekly.pct >= 0 ? "+" : ""}${gains.weekly.pct}%` : "No price data"} color={!gains?.weekly ? "#6B7280" : gains.weekly.gain >= 0 ? "#22C55E" : "#EF4444"} />
            <StatCard label="This Month" value={monthGain !== null ? `${monthGain >= 0 ? "+" : ""}${fmtShort(monthGain)}` : "—"} sub={monthPct !== null ? `${monthPct >= 0 ? "+" : ""}${monthPct}%` : "No prior month"} color={monthGain === null ? "#6B7280" : monthGain >= 0 ? "#22C55E" : "#EF4444"} />
          </div>

          {/* Chart + Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
            <div className="lg:col-span-3 card">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold">Portfolio Over Time</div>
                {safeHistory.length > 0 && <div className="text-[11px] text-gray-500">{new Date(safeHistory[0].date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — Present</div>}
              </div>
              {safeHistory.length > 1 ? (
                <>
                  <Sparkline data={safeHistory.map((h) => h.portfolio_value)} width={500} height={120} color="#14B8A6" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-2 px-1">
                    {safeHistory.filter((_, i) => i === 0 || i === safeHistory.length - 1 || i === Math.floor(safeHistory.length / 2)).map((h) => (
                      <span key={h.date}>{new Date(h.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</span>
                    ))}
                  </div>
                </>
              ) : <div className="text-gray-500 text-sm py-8 text-center">Chart appears after the second monthly valuation</div>}
            </div>
            <div className="lg:col-span-2 card">
              <div className="text-sm font-semibold mb-3">Your Allocation</div>
              <div className="flex items-center gap-4">
                <DonutChart segments={segments} size={100} />
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
            </div>
          </div>

          {/* Recent contribution receipt */}
          {contributions?.length > 0 && (() => {
            const latest = contributions[0];
            const daysAgo = Math.floor((Date.now() - new Date(latest.date).getTime()) / (86400000));
            if (daysAgo > 7) return null;
            return (
              <div className="card mb-4 flex items-center gap-3" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(22,101,52,0.08)" }}>
                <div className="w-9 h-9 rounded-lg bg-green-900/30 flex items-center justify-center shrink-0"><ArrowDown size={18} className="text-green-400" /></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-green-400">Contribution Recorded</div>
                  <div className="text-xs text-gray-400">{fmtUGX(latest.amount)} {latest.type} on {fmtDate(latest.date)}{latest.description ? ` — ${latest.description}` : ""}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-green-900/20 text-green-400 text-[10px] font-semibold shrink-0">{daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`}</span>
              </div>
            );
          })()}

          {/* Holdings + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              {/* Holdings */}
              <div className="card">
                <div className="text-sm font-semibold mb-3">Your Holdings</div>
                {segments.map((s) => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-surface-3 last:border-0">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded" style={{ background: s.color }} /><span className="text-sm">{s.label.replace(" (UAP)", "")}</span></div>
                    <div className="text-sm font-mono font-semibold">{fmtUGX(s.value)}</div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-sm font-bold"><span>Total</span><span className="font-mono">{fmtUGX(v.portfolio_value)}</span></div>
              </div>

              {/* Active Loan */}
              {active_loan && (() => {
                const totalDue = active_loan.total_due || active_loan.amount;
                const remaining = Math.max(0, totalDue - (active_loan.amount_paid || 0));
                const paidPct = totalDue > 0 ? Math.min(100, ((active_loan.amount_paid || 0) / totalDue) * 100) : 0;
                const dueDate = active_loan.activated_at ? new Date(new Date(active_loan.activated_at).setMonth(new Date(active_loan.activated_at).getMonth() + 3)) : null;
                const overdue = active_loan.status === "active" && dueDate && new Date() > dueDate;
                const borderColor = overdue ? "rgba(239,68,68,0.4)" : active_loan.status === "active" ? "rgba(59,130,246,0.3)" : "rgba(217,119,6,0.3)";
                const bgColor = overdue ? "rgba(127,29,29,0.08)" : active_loan.status === "active" ? "rgba(30,58,138,0.08)" : "rgba(120,53,15,0.08)";

                return (
                  <div className="card" style={{ borderColor, background: bgColor }}>
                    {overdue && (
                      <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-xs rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} /> Loan overdue — all contributions go to recovery
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: overdue ? "#F87171" : active_loan.status === "active" ? "#60A5FA" : "#FBBF24" }}>
                        <Landmark size={16} />
                        {active_loan.status === "active" ? "Active Loan" : "Loan Request"}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${overdue ? "bg-red-900/20 text-red-400" : active_loan.status === "active" ? "bg-blue-900/20 text-blue-400" : "bg-amber-900/20 text-amber-400"}`}>
                        {overdue ? "Overdue" : active_loan.status === "pending" ? (active_loan.approved_by_1 ? "Approved (1/2)" : "Pending") : active_loan.status === "active" ? "Active" : "Approved"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div><span className="text-xs text-gray-500">Loan Amount</span><div className="font-mono font-semibold">{fmtUGX(active_loan.amount)}</div></div>
                      <div><span className="text-xs text-gray-500">Total Due</span><div className="font-mono font-semibold">{fmtUGX(totalDue)}</div></div>
                      <div><span className="text-xs text-gray-500">Remaining</span><div className={`font-mono font-semibold ${overdue ? "text-red-400" : "text-amber-400"}`}>{fmtUGX(remaining)}</div></div>
                      {dueDate && <div><span className="text-xs text-gray-500">Due By</span><div className={`font-mono font-semibold ${overdue ? "text-red-400" : ""}`}>{fmtDate(dueDate)}</div></div>}
                    </div>

                    {active_loan.status === "active" && totalDue > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span>Repaid</span>
                          <span>{Math.round(paidPct)}%</span>
                        </div>
                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${overdue ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${paidPct}%` }} />
                        </div>
                      </div>
                    )}

                    {active_loan.status === "pending" && !active_loan.activated_at && (
                      <div className="text-xs text-amber-400 mb-2">Awaiting admin approval{active_loan.approved_by_1 ? " (1 of 2 approved)" : ""}</div>
                    )}
                    <a href="/loans" className="text-xs text-brand-500 hover:text-brand-400 inline-block">View details &rarr;</a>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-4">
              {/* Fines */}
              {unpaid_fines?.length > 0 && (
                <div className="card" style={{ borderColor: "rgba(217,119,6,0.3)", background: "rgba(120,53,15,0.1)" }}>
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2"><AlertTriangle size={16} /> Outstanding Fines</div>
                  {unpaid_fines.map((f) => (
                    <div key={f.id} className="flex justify-between text-sm py-1.5"><span className="text-gray-400">{f.reason}</span><span className="font-mono text-amber-400">{fmtUGX(f.amount)}</span></div>
                  ))}
                </div>
              )}

              {/* Recent Activity */}
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
      )}

      {/* Club Activity Feed */}
      {tab === "personal" && clubActivity.length > 0 && (
        <div className="card mt-5">
          <div className="text-sm font-semibold mb-3">Club Activity</div>
          <div className="divide-y divide-surface-3">
            {clubActivity.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.icon === "dollar" ? "bg-green-900/30" : item.icon === "landmark" ? "bg-blue-900/30" : "bg-amber-900/30"}`}>
                  {item.icon === "dollar" && <DollarSign size={14} className="text-green-400" />}
                  {item.icon === "landmark" && <Landmark size={14} className="text-blue-400" />}
                  {item.icon === "alert" && <AlertTriangle size={14} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0 text-xs text-gray-400 truncate">{titleCase(item.text)}</div>
                <div className="text-[10px] text-gray-600 shrink-0">{fmtDate(item.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CLUB OVERVIEW TAB ═══ */}
      {tab === "club" && (
        <div>
          {/* Club Hero */}
          <div className="card mb-5" style={{ borderColor: "rgba(59,130,246,0.2)" }}>
            <div className="text-xs text-gray-500 mb-1">Club Portfolio Value</div>
            <div className="text-3xl font-bold font-mono">{fmtUGX(clubTotal)}</div>
            <div className="text-xs text-gray-500 mt-1">Your share: <span className="font-mono text-white">{v.ownership_pct}%</span> = <span className="font-mono text-brand-500">{fmtUGX(v.portfolio_value)}</span></div>
          </div>

          {/* Club Daily/Weekly */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <StatCard label="Club Today" value={club_gains?.daily ? `${club_gains.daily.gain >= 0 ? "+" : ""}${fmtShort(club_gains.daily.gain)}` : "—"} sub={club_gains?.daily ? `${club_gains.daily.pct >= 0 ? "+" : ""}${club_gains.daily.pct}%` : "No price data"} color={!club_gains?.daily ? "#6B7280" : club_gains.daily.gain >= 0 ? "#22C55E" : "#EF4444"} />
            <StatCard label="Club This Week" value={club_gains?.weekly ? `${club_gains.weekly.gain >= 0 ? "+" : ""}${fmtShort(club_gains.weekly.gain)}` : "—"} sub={club_gains?.weekly ? `${club_gains.weekly.pct >= 0 ? "+" : ""}${club_gains.weekly.pct}%` : "No price data"} color={!club_gains?.weekly ? "#6B7280" : club_gains.weekly.gain >= 0 ? "#22C55E" : "#EF4444"} />
            <StatCard label="Club All-Time" value={fmtUGX(clubTotal - (clubHist[0]?.total_invested || 0))} sub="Since inception" color="#14B8A6" />
          </div>

          {/* Club Chart + Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
            <div className="lg:col-span-3 card">
              <div className="text-sm font-semibold mb-3">Club Growth</div>
              {clubHist.length > 1 ? (
                <>
                  <Sparkline data={clubHist.map((h) => h.total_value)} width={500} height={120} />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-2 px-1">
                    {clubHist.filter((_, i) => i === 0 || i === clubHist.length - 1 || i === Math.floor(clubHist.length / 2)).map((h) => (
                      <span key={h.date}>{new Date(h.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</span>
                    ))}
                  </div>
                </>
              ) : <div className="text-gray-500 text-sm py-8 text-center">No club history yet</div>}
            </div>
            <div className="lg:col-span-2 card">
              <div className="text-sm font-semibold mb-3">Club Allocation</div>
              <div className="flex items-center gap-4">
                <DonutChart segments={clubSegments} size={100} />
                <div className="flex-1 space-y-1.5">
                  {clubSegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                      <span className="text-gray-400 flex-1 truncate">{s.label.replace(" (UAP)", "")}</span>
                      <span className="font-mono font-semibold">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Club Holdings */}
          <div className="card">
            <div className="text-sm font-semibold mb-3">Club Holdings</div>
            {clubSegments.map((s) => (
              <div key={s.label} className="flex justify-between items-center py-2 border-b border-surface-3 last:border-0">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded" style={{ background: s.color }} /><span className="text-sm">{s.label.replace(" (UAP)", "")}</span></div>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">{fmtUGX(s.value)}</div>
                  <div className="text-[11px] text-gray-500">Your share: {fmtShort(s.value * (v.ownership_pct / 100))}</div>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-sm font-bold"><span>Total</span><span className="font-mono">{fmtUGX(clubTotal)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const [members, setMembers] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [contributions, setContributions] = useState([]);

  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/portfolio").then((r) => r.json()),
      fetch("/api/activity").then((r) => r.json()),
      fetch(`/api/contributions?type=deposit&from=${monthStart}`).then((r) => r.json()),
    ]).then(([m, p, a, c]) => {
      setMembers(Array.isArray(m) ? m : []);
      setPortfolio(p);
      setActivity(Array.isArray(a) ? a : []);
      setContributions(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonPage cards={3} rows={5} />;

  const totalValue = portfolio?.totalValue || 0;
  const history = portfolio?.history || [];
  const summary = portfolio?.summary || {};
  const clubGains = portfolio?.gains || {};
  const totalInvested = members.reduce((s, m) => s + (m.snapshot?.total_invested || 0), 0);
  const totalGain = totalValue - totalInvested;
  const returnPct = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : 0;
  const arrearsMembers = members.filter((m) => (m.snapshot?.advance_contribution || 0) < 0);
  const totalArrears = arrearsMembers.reduce((s, m) => s + m.snapshot.advance_contribution, 0);

  const segments = Object.entries(summary).map(([cls, data]) => ({
    label: ASSET_CLASS_LABELS[cls] || cls, pct: data.percentage || 0, color: ASSET_CLASS_COLORS[cls] || "#666", value: data.value,
  })).filter((s) => s.pct > 0);

  // Monthly contribution reminder
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const latestSnapshotDate = members[0]?.snapshot_date;
  const snapshotMonth = latestSnapshotDate ? latestSnapshotDate.slice(0, 7) : null;
  const contributionsDue = !snapshotMonth || snapshotMonth < currentMonthStr;

  return (
    <div className="animate-in">
      <div className="mb-5"><h1 className="text-2xl font-bold">Club Dashboard</h1><p className="text-sm text-gray-500 mt-1">{CLUB_SHORT} Investment Club overview</p></div>

      {contributionsDue && (
        <div className="card mb-5 flex items-center gap-3" style={{ borderColor: "rgba(217,119,6,0.3)", background: "rgba(120,53,15,0.1)" }}>
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-400">Monthly contributions due</div>
            <div className="text-xs text-gray-400">Record member contributions for {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} and run a valuation.</div>
          </div>
          <a href="/contributions" className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">Record Now</a>
        </div>
      )}

      {/* Members who haven't contributed this month */}
      {(() => {
        const paidMemberIds = new Set(contributions.map((c) => c.member_id));
        const unpaid = members.filter((m) => !paidMemberIds.has(m.id));
        if (unpaid.length === 0) return null;
        return (
          <div className="card mb-5 p-0 overflow-hidden" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
            <div className="px-4 py-3 border-b border-surface-3 flex justify-between items-center">
              <div className="text-sm font-semibold text-red-400">{unpaid.length} member{unpaid.length > 1 ? "s" : ""} not yet contributed this month</div>
              <a href="/contributions" className="text-xs text-brand-500 hover:text-brand-400">Record Now</a>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {unpaid.map((m) => (
                <span key={m.id} className="px-2.5 py-1 rounded-lg bg-red-900/10 border border-red-800/20 text-xs text-red-400">
                  {titleCase(m.name)}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-5">
        <a href="/contributions" className="bg-surface-1 hover:bg-surface-2 border border-surface-3 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><DollarSign size={14} className="text-green-400" />Record Contributions</a>
        <a href="/admin" className="bg-surface-1 hover:bg-surface-2 border border-surface-3 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><BarChart3 size={14} className="text-brand-500" />Run Valuation</a>
        <a href="/admin" className="bg-surface-1 hover:bg-surface-2 border border-surface-3 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><PieChart size={14} className="text-purple-400" />Manage Investments</a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <StatCard label="Portfolio Value" value={fmtUGX(totalValue)} sub={`${returnPct >= 0 ? "+" : ""}${returnPct}% all-time`} color="#22C55E" />
        <StatCard label="Total Invested" value={fmtUGX(totalInvested)} sub={`${members.length} members`} color="#3B82F6" />
        <StatCard label="Arrears" value={fmtUGX(Math.abs(totalArrears))} sub={`${arrearsMembers.length} members behind`} color="#EF4444" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Today" value={clubGains.daily ? `${clubGains.daily.gain >= 0 ? "+" : ""}${fmtShort(clubGains.daily.gain)}` : "—"} sub={clubGains.daily ? `${clubGains.daily.pct >= 0 ? "+" : ""}${clubGains.daily.pct}%` : "No price data"} color={!clubGains.daily ? "#6B7280" : clubGains.daily.gain >= 0 ? "#22C55E" : "#EF4444"} />
        <StatCard label="This Week" value={clubGains.weekly ? `${clubGains.weekly.gain >= 0 ? "+" : ""}${fmtShort(clubGains.weekly.gain)}` : "—"} sub={clubGains.weekly ? `${clubGains.weekly.pct >= 0 ? "+" : ""}${clubGains.weekly.pct}%` : "No price data"} color={!clubGains.weekly ? "#6B7280" : clubGains.weekly.gain >= 0 ? "#22C55E" : "#EF4444"} />
        <StatCard label="All-Time Gain" value={fmtUGX(totalGain)} sub="Since inception" color={totalGain >= 0 ? "#14B8A6" : "#EF4444"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-3 card">
          <div className="text-sm font-semibold mb-3">Portfolio History</div>
          {history.length > 1 ? <Sparkline data={history.map((h) => h.total_value)} width={600} height={120} /> : <div className="text-gray-500 text-sm py-8 text-center">No history yet</div>}
        </div>
        <div className="lg:col-span-2 card">
          <div className="text-sm font-semibold mb-3">Asset Allocation</div>
          <div className="flex items-center gap-5">
            <DonutChart segments={segments} size={110} />
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
            const ret = s && s.total_invested > 0 ? (((s.portfolio_value - s.total_invested) / s.total_invested) * 100).toFixed(1) : 0;
            return (
              <div key={m.id} className="grid grid-cols-3 sm:grid-cols-5 items-center px-4 sm:px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]">
                <div className="flex items-center gap-2.5"><Avatar name={m.name} size={30} /><div><div className="font-medium truncate">{titleCase(m.name)}</div><div className="text-[11px] text-gray-500 hidden sm:block">{m.monthly_contribution > 0 ? `${fmtShort(m.monthly_contribution)}/mo` : ""}</div></div></div>
                <div className="text-right font-mono font-semibold">{fmtShort(s?.portfolio_value || 0)}</div>
                <div className={`text-right font-semibold ${ret >= 0 ? "text-green-400" : "text-red-400"}`}>{ret >= 0 ? "+" : ""}{ret}%</div>
                <div className="hidden sm:block text-right font-mono">{fmtShort(s?.total_invested || 0)}</div>
                <div className="hidden sm:block text-right"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${(s?.advance_contribution || 0) >= 0 ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>{(s?.advance_contribution || 0) >= 0 ? "Current" : `−${fmtShort(Math.abs(s.advance_contribution))}`}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div className="card mt-5">
          <div className="text-sm font-semibold mb-3">Recent Activity</div>
          <div className="divide-y divide-surface-3">
            {activity.slice(0, 10).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  item.icon === "dollar" ? "bg-green-900/30" : item.icon === "landmark" ? "bg-blue-900/30" : "bg-amber-900/30"
                }`}>
                  {item.icon === "dollar" && <DollarSign size={14} className="text-green-400" />}
                  {item.icon === "landmark" && <Landmark size={14} className="text-blue-400" />}
                  {item.icon === "alert" && <AlertTriangle size={14} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0 text-xs text-gray-400 truncate">{titleCase(item.text)}</div>
                <div className="text-[10px] text-gray-600 shrink-0">{fmtDate(item.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const user = useUser();
  if (!user) return null;

  if (user.role === "admin") {
    return (
      <>
        <AdminNotifications />
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
