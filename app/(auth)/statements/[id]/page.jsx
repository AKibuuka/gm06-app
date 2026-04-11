"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fmtUGX } from "@/lib/format";
import { CLUB_NAME } from "@/lib/constants";

export default function StatementPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/statements?member_id=${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading statement...</div>;
  if (!data?.snapshot) return <div style={{ padding: 40, textAlign: "center", color: "#666" }}>No statement data available.</div>;

  const s = data.snapshot;
  const m = data.member;
  const gain = s.portfolio_value - s.total_invested;
  const returnPct = s.total_invested > 0 ? ((gain / s.total_invested) * 100).toFixed(1) : 0;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .statement { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
        .statement { max-width: 700px; margin: 20px auto; padding: 40px; background: white; color: #1a1a1a; font-family: 'DM Sans', Arial, sans-serif; }
        .statement table { width: 100%; border-collapse: collapse; }
        .statement th, .statement td { padding: 6px 10px; font-size: 13px; }
        .statement th { text-align: left; color: #0f766e; border-bottom: 2px solid #0f766e; font-size: 12px; }
        .statement tbody tr { border-bottom: 1px solid #e5e7eb; }
        .statement .total-row { border-top: 2px solid #0f766e; font-weight: 700; }
      `}</style>

      {/* Print/Download bar */}
      <div className="no-print" style={{ background: "#0C1117", padding: "12px 20px", display: "flex", justifyContent: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => window.print()} style={{ background: "#0f766e", color: "white", border: "none", padding: "8px 24px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          Download as PDF (Print → Save as PDF)
        </button>
        <button onClick={() => window.close()} style={{ background: "#252D3A", color: "#ccc", border: "none", padding: "8px 24px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          Close
        </button>
      </div>

      <div className="statement">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 12, color: "#888" }}>{new Date(data.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f766e", margin: "8px 0 2px" }}>{CLUB_NAME}</h1>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#888" }}>INVESTMENT CLUB</div>
        </div>

        {/* Member Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24, fontSize: 14 }}>
          <div><span style={{ color: "#888", fontSize: 12 }}>Portfolio Holder</span><br /><strong style={{ fontSize: 16 }}>{m.name}</strong></div>
          <div></div>
          <div><span style={{ color: "#888", fontSize: 12 }}>Portfolio Value</span><br /><strong>{fmtUGX(s.portfolio_value)}</strong></div>
          <div><span style={{ color: "#888", fontSize: 12 }}>Total Gain</span><br /><strong style={{ color: "#059669" }}>{fmtUGX(gain)}</strong></div>
          <div><span style={{ color: "#888", fontSize: 12 }}>Total Invested</span><br /><strong>{fmtUGX(s.total_invested)}</strong></div>
          <div><span style={{ color: "#888", fontSize: 12 }}>Total Return</span><br /><strong style={{ color: "#059669" }}>{returnPct}%</strong></div>
          <div><span style={{ color: "#888", fontSize: 12 }}>Monthly Contribution</span><br /><strong>{fmtUGX(m.monthly_contribution)}</strong></div>
        </div>

        {/* Holdings Table */}
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Portfolio Holdings</h3>
        <table>
          <thead>
            <tr>
              <th>Asset Class</th>
              <th style={{ textAlign: "right" }}>Value (UGX)</th>
              <th style={{ textAlign: "right" }}>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {(data.allocation || []).map((a, i) => (
              <tr key={i}>
                <td>{a.asset}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{a.value > 0 ? Math.round(a.value).toLocaleString() : "-"}</td>
                <td style={{ textAlign: "right" }}>{a.pct > 0 ? `${a.pct}%` : "0.0%"}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Sum</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{Math.round(s.portfolio_value).toLocaleString()}</td>
              <td style={{ textAlign: "right" }}>100%</td>
            </tr>
          </tbody>
        </table>

        {/* Advance Contribution */}
        <div style={{ marginTop: 20, background: "#0f766e", color: "white", borderRadius: 8, padding: "10px 20px", textAlign: "center", fontSize: 14 }}>
          <strong>Advance Contribution:</strong> {fmtUGX(s.advance_contribution)}
        </div>

        {/* Note */}
        <p style={{ marginTop: 16, fontSize: 11, color: "#888", textAlign: "center" }}>
          Note: The Valuation of Stocks, Digital Assets and Private Equity may include unrealised profits/losses.
        </p>

        {/* Footer */}
        <div style={{ marginTop: 30, paddingTop: 16, borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#aaa", textAlign: "center" }}>
          GM06 Investment Club · Individual Statement · Confidential
        </div>
      </div>
    </>
  );
}
