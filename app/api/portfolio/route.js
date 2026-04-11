import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();

  // Get all active investments grouped by asset class
  const { data: investments } = await db.from("investments").select("*").eq("is_active", true);

  const summary = {};
  let totalValue = 0;
  let totalCost = 0;

  (investments || []).forEach((inv) => {
    if (!summary[inv.asset_class]) summary[inv.asset_class] = { value: 0, cost: 0, investments: [] };
    summary[inv.asset_class].value += inv.current_value || 0;
    summary[inv.asset_class].cost += inv.cost_basis || 0;
    summary[inv.asset_class].investments.push(inv);
    totalValue += inv.current_value || 0;
    totalCost += inv.cost_basis || 0;
  });

  for (const cls in summary) {
    summary[cls].percentage = totalValue > 0 ? (summary[cls].value / totalValue) * 100 : 0;
  }

  // Historical snapshots
  const { data: history } = await db
    .from("portfolio_snapshots")
    .select("*")
    .order("date");

  return NextResponse.json({ summary, totalValue, totalCost, investments, history: history || [] });
}
