import { NextResponse } from "next/server";
export const maxDuration = 30;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/snapshots — list portfolio snapshots
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data } = await db.from("portfolio_snapshots").select("*").order("date", { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}

// POST /api/snapshots — generate a new monthly valuation (admin only)
// Body: { date: "2026-04-01" }
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { date } = await request.json();
  if (!date) return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });

  const db = getServiceClient();

  // 1. Get all active investments and calculate total portfolio value
  const { data: investments } = await db.from("investments").select("*").eq("is_active", true);
  if (!investments) return NextResponse.json({ error: "No investments found" }, { status: 400 });

  const assetTotals = {};
  let totalPortfolioValue = 0;

  for (const inv of investments) {
    const cls = inv.asset_class;
    if (!assetTotals[cls]) assetTotals[cls] = 0;
    assetTotals[cls] += inv.current_value || 0;
    totalPortfolioValue += inv.current_value || 0;
  }

  // 2. Get all active members
  const { data: members } = await db.from("members").select("id, name, monthly_contribution").eq("is_active", true);
  if (!members?.length) return NextResponse.json({ error: "No active members" }, { status: 400 });

  // 3. Calculate each member's total contributions (deposits - withdrawals)
  const memberContributions = {};
  for (const m of members) {
    const { data: contribs } = await db
      .from("contributions")
      .select("amount, type")
      .eq("member_id", m.id)
      .lte("date", date);

    let totalDeposits = 0;
    let totalFines = 0;
    let totalExpenses = 0;
    let totalWithdrawals = 0;

    (contribs || []).forEach((c) => {
      switch (c.type) {
        case "deposit": totalDeposits += c.amount; break;
        case "fine": totalFines += c.amount; break;
        case "expense": totalExpenses += c.amount; break;
        case "withdrawal": totalWithdrawals += c.amount; break;
      }
    });

    // Net contribution = deposits (what the member put in)
    memberContributions[m.id] = {
      totalInvested: totalDeposits,
      netContribution: totalDeposits - totalWithdrawals,
      fines: totalFines,
      expenses: totalExpenses,
    };
  }

  // 4. Calculate total club contributions (sum of all members' net contributions)
  const totalClubContributions = Object.values(memberContributions).reduce((s, c) => s + c.netContribution, 0);

  // 5. Calculate each member's share of portfolio
  const memberSnapshots = [];
  for (const m of members) {
    const mc = memberContributions[m.id] || { totalInvested: 0, netContribution: 0 };

    // Member's share = their net contribution / total club contributions
    const share = totalClubContributions > 0 ? mc.netContribution / totalClubContributions : 1 / members.length;
    const portfolioValue = totalPortfolioValue * share;

    // Advance = total contributed - expected contribution (based on schedule)
    // For simplicity: advance = net contribution - average contribution across members
    const avgContribution = totalClubContributions / members.length;
    const advance = mc.netContribution - avgContribution;

    memberSnapshots.push({
      member_id: m.id,
      date,
      total_invested: mc.totalInvested,
      portfolio_value: Math.round(portfolioValue * 100) / 100,
      advance_contribution: Math.round(advance * 100) / 100,
    });
  }

  // 6. Upsert member snapshots (update if date already exists)
  for (const snap of memberSnapshots) {
    const { data: existing } = await db
      .from("member_snapshots")
      .select("id")
      .eq("member_id", snap.member_id)
      .eq("date", snap.date)
      .single();

    if (existing) {
      await db.from("member_snapshots").update(snap).eq("id", existing.id);
    } else {
      await db.from("member_snapshots").insert(snap);
    }
  }

  // 7. Upsert portfolio snapshot
  const portfolioSnap = {
    date,
    total_value: totalPortfolioValue,
    total_invested: totalClubContributions,
    fixed_income_value: assetTotals.fixed_income || 0,
    stocks_value: assetTotals.stocks || 0,
    digital_assets_value: assetTotals.digital_assets || 0,
    real_estate_value: assetTotals.real_estate || 0,
    private_equity_value: assetTotals.private_equity || 0,
    loans_value: assetTotals.loans || 0,
    cash_value: assetTotals.cash || 0,
  };

  const { data: existingSnap } = await db.from("portfolio_snapshots").select("id").eq("date", date).single();
  if (existingSnap) {
    await db.from("portfolio_snapshots").update(portfolioSnap).eq("id", existingSnap.id);
  } else {
    await db.from("portfolio_snapshots").insert(portfolioSnap);
  }

  return NextResponse.json({
    ok: true,
    date,
    totalPortfolioValue,
    membersProcessed: memberSnapshots.length,
    assetTotals,
  });
}
