"use client";
import { useState, useEffect } from "react";
import { useUser } from "@/components/AuthShell";
import { DonutChart, Sparkline } from "@/components/Charts";
import { fmtUGX, fmtShort, ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "@/lib/format";

export default function PortfolioPage() {
  const user = useUser();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio").then((r) => r.json()).then(setPortfolio).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading portfolio...</div>;
  if (!portfolio) return <div className="text-gray-500 text-sm p-8">Unable to load portfolio data.</div>;

  const { summary, totalValue, investments, history } = portfolio;
  const segments = Object.entries(summary || {}).map(([cls, data]) => ({
    label: ASSET_CLASS_LABELS[cls] || cls, cls, pct: data.percentage || 0, color: ASSET_CLASS_COLORS[cls] || "#666", value: data.value, cost: data.cost, investments: data.investments || [],
  }));

  const histValues = (history || []).map((h) => h.total_value);
  const peak = Math.max(...histValues, 0);
  const fromPeak = peak > 0 ? ((totalValue / peak - 1) * 100).toFixed(1) : 0;

  return (
    <div className="animate-in">
      <div className="mb-7"><h1 className="text-2xl font-bold">Portfolio</h1><p className="text-sm text-gray-500 mt-1">Club-wide asset allocation and holdings</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-sm font-semibold mb-4">Allocation</div>
          <div className="flex items-center gap-6">
            <DonutChart segments={segments} size={150} />
            <div className="flex-1 space-y-2">
              {segments.filter((s) => s.pct > 0).map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />{s.label.replace(" (UAP)", "")}</span><span className="font-mono font-semibold">{fmtShort(s.value)}</span></div>
                  <div className="h-1.5 bg-surface-2 rounded-full"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-4">Growth</div>
          {histValues.length > 1 ? <Sparkline data={histValues} width={500} height={120} /> : <div className="text-gray-500 text-sm py-8 text-center">No history yet</div>}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Current", value: fmtShort(totalValue), color: "#14B8A6" },
              { label: "All-time High", value: fmtShort(peak), color: "#3B82F6" },
              { label: "From Peak", value: `${fromPeak}%`, color: Number(fromPeak) >= 0 ? "#22C55E" : "#EF4444" },
            ].map((k) => (
              <div key={k.label} className="bg-surface-2 rounded-lg p-3 text-center"><div className="text-[10px] text-gray-500">{k.label}</div><div className="text-sm font-bold font-mono" style={{ color: k.color }}>{k.value}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings by asset class — only show detail to admin */}
      {user?.role === "admin" && segments.filter((s) => s.investments.length > 0).map((s) => (
        <div key={s.cls} className="card mb-4 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-3 flex justify-between items-center bg-surface-2">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: s.color }} /><span className="text-sm font-semibold">{s.label}</span></div>
            <div className="text-sm font-mono font-semibold">{fmtUGX(s.value)}</div>
          </div>
          <div className="overflow-x-auto">
            {s.investments.map((inv) => {
              const gain = (inv.current_value || 0) - (inv.cost_basis || 0);
              const gainPct = inv.cost_basis > 0 ? ((gain / inv.cost_basis) * 100).toFixed(1) : 0;
              return (
                <div key={inv.id} className="grid grid-cols-5 items-center px-5 py-3 border-b border-surface-3 hover:bg-surface-2 transition-colors text-[13px]">
                  <div><div className="font-medium">{inv.name}</div>{inv.ticker && <div className="text-[11px] text-gray-500">{inv.ticker}</div>}</div>
                  <div className="text-right font-mono text-gray-400">{inv.quantity > 1 ? Number(inv.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}</div>
                  <div className="text-right font-mono text-gray-400">{fmtShort(inv.cost_basis)}</div>
                  <div className="text-right font-mono font-semibold">{fmtShort(inv.current_value)}</div>
                  <div className={`text-right font-semibold ${gain >= 0 ? "text-green-400" : "text-red-400"}`}>{gain >= 0 ? "+" : ""}{gainPct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
