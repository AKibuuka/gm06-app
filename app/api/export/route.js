import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/export?type=members|contributions|portfolio|arrears
export async function GET(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "members";
  const db = getServiceClient();

  let csv = "";
  let filename = "";

  switch (type) {
    case "members": {
      const { data: members } = await db.from("members").select("id, name, email, phone, monthly_contribution, is_active, joined_at").eq("is_active", true).order("name");
      const { data: latestSnap } = await db.from("member_snapshots").select("date").order("date", { ascending: false }).limit(1).single();
      let snapshots = {};
      if (latestSnap) {
        const { data: snaps } = await db.from("member_snapshots").select("*").eq("date", latestSnap.date);
        (snaps || []).forEach((s) => { snapshots[s.member_id] = s; });
      }

      csv = "Name,Email,Phone,Monthly Contribution,Total Invested,Portfolio Value,Total Gain,Return %,Advance Contribution\n";
      (members || []).forEach((m) => {
        const s = snapshots[m.id];
        const gain = s ? s.portfolio_value - s.total_invested : 0;
        const ret = s && s.total_invested > 0 ? ((gain / s.total_invested) * 100).toFixed(1) : 0;
        csv += `"${m.name}","${m.email}","${m.phone || ""}",${m.monthly_contribution},${s?.total_invested || 0},${s?.portfolio_value || 0},${Math.round(gain)},${ret}%,${s?.advance_contribution || 0}\n`;
      });
      filename = "gm06_members.csv";
      break;
    }

    case "contributions": {
      const { data } = await db.from("contributions").select("date, amount, type, description, bank_ref, members(name)").order("date", { ascending: false }).limit(1000);
      csv = "Date,Member,Type,Amount,Bank Ref,Description\n";
      (data || []).forEach((c) => {
        csv += `${c.date},"${c.members?.name || ""}",${c.type},${c.amount},"${c.bank_ref || ""}","${(c.description || "").replace(/"/g, '""')}"\n`;
      });
      filename = "gm06_contributions.csv";
      break;
    }

    case "portfolio": {
      const { data } = await db.from("investments").select("name, ticker, asset_class, quantity, cost_basis, current_price, current_value, price_source, is_active").order("asset_class").order("name");
      csv = "Name,Ticker,Asset Class,Quantity,Cost Basis,Current Price,Current Value,Price Source,Active\n";
      (data || []).forEach((i) => {
        csv += `"${i.name}","${i.ticker || ""}","${i.asset_class}",${i.quantity},${i.cost_basis},${i.current_price},${i.current_value},"${i.price_source}",${i.is_active}\n`;
      });
      filename = "gm06_investments.csv";
      break;
    }

    case "arrears": {
      const { data: latestSnap } = await db.from("member_snapshots").select("date").order("date", { ascending: false }).limit(1).single();
      if (!latestSnap) { csv = "No data"; filename = "gm06_arrears.csv"; break; }

      const { data: snaps } = await db.from("member_snapshots").select("*, members(name, phone, email)").eq("date", latestSnap.date).lt("advance_contribution", 0).order("advance_contribution");
      csv = "Name,Email,Phone,Amount Owed,Portfolio Value\n";
      (snaps || []).forEach((s) => {
        csv += `"${s.members?.name || ""}","${s.members?.email || ""}","${s.members?.phone || ""}",${Math.abs(s.advance_contribution)},${s.portfolio_value}\n`;
      });
      filename = "gm06_arrears.csv";
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
