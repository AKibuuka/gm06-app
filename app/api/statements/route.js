import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/statements?member_id=xxx&date=2026-03-01
// Returns full statement data for a member at a given date
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member_id");
  const date = searchParams.get("date") || "2026-03-01";

  // Members can only get their own statement
  if (!isAdmin(session) && memberId !== session.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const db = getServiceClient();

  // Get member
  const { data: member } = await db.from("members").select("*").eq("id", memberId).single();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Get member snapshot for the date
  const { data: snapshot } = await db.from("member_snapshots").select("*").eq("member_id", memberId).eq("date", date).single();

  // Get portfolio snapshot for allocation percentages
  const { data: portfolioSnap } = await db.from("portfolio_snapshots").select("*").eq("date", date).single();

  // Get contribution history
  const { data: contributions } = await db
    .from("contributions")
    .select("*")
    .eq("member_id", memberId)
    .lte("date", date)
    .order("date", { ascending: false });

  // Get fines
  const { data: fines } = await db
    .from("fines")
    .select("*")
    .eq("member_id", memberId)
    .lte("date", date)
    .order("date", { ascending: false });

  // Calculate allocation from portfolio snapshot
  let allocation = [];
  if (portfolioSnap && snapshot) {
    const totalPV = portfolioSnap.total_value || 1;
    const classes = [
      { name: "Fixed Income Securities (UAP)", value: portfolioSnap.fixed_income_value },
      { name: "Stocks", value: portfolioSnap.stocks_value },
      { name: "Digital Assets", value: portfolioSnap.digital_assets_value },
      { name: "Real Estate", value: portfolioSnap.real_estate_value },
      { name: "Private Equity", value: portfolioSnap.private_equity_value },
      { name: "Loans", value: portfolioSnap.loans_value },
      { name: "Cash", value: portfolioSnap.cash_value },
    ];

    allocation = classes.map((c) => {
      const pct = (c.value / totalPV) * 100;
      const memberValue = snapshot.portfolio_value * (pct / 100);
      return { asset: c.name, pct: Math.round(pct * 10) / 10, value: Math.round(memberValue * 100) / 100 };
    });
  }

  return NextResponse.json({
    member: { id: member.id, name: member.name, phone: member.phone, email: member.email, monthly_contribution: member.monthly_contribution },
    snapshot,
    allocation,
    contributions: contributions || [],
    fines: fines || [],
    date,
    club: { name: "GREEN MINDS 06 INVESTMENT CLUB" },
  });
}
