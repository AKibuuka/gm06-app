import { NextResponse } from "next/server";
export const maxDuration = 30;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/snapshots — list portfolio snapshots (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

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

  // 2. Get all active members and settings
  const { data: members } = await db.from("members").select("id, name, monthly_contribution, joined_at").eq("is_active", true);
  if (!members?.length) return NextResponse.json({ error: "No active members" }, { status: 400 });

  // 3. Fetch ALL contributions up to the date in a single query (avoids N+1)
  const { data: allContribs } = await db
    .from("contributions")
    .select("member_id, amount, type")
    .lte("date", date);

  // Group contributions by member in memory
  const memberContributions = {};
  for (const m of members) {
    memberContributions[m.id] = { totalInvested: 0, netContribution: 0, fines: 0, expenses: 0 };
  }
  for (const c of (allContribs || [])) {
    const mc = memberContributions[c.member_id];
    if (!mc) continue;
    switch (c.type) {
      case "deposit": mc.totalInvested += c.amount; mc.netContribution += c.amount; break;
      case "fine": mc.fines += c.amount; break;
      case "expense": mc.expenses += c.amount; mc.netContribution -= c.amount; break;
      case "withdrawal": mc.netContribution -= c.amount; break;
    }
  }

  // 4. Calculate total club contributions (sum of all members' net contributions)
  const totalClubContributions = Object.values(memberContributions).reduce((s, c) => s + c.netContribution, 0);

  // 4b. Fetch required_contribution from settings for arrears calculation
  const { data: reqSetting } = await db.from("settings").select("value").eq("key", "required_contribution").single();
  const requiredAmount = parseFloat(reqSetting?.value) || 0;

  // Calculate months from earliest joined_at to snapshot date (all members share same start)
  const earliestJoin = members.reduce((earliest, m) => {
    return !earliest || m.joined_at < earliest ? m.joined_at : earliest;
  }, null);
  const snapshotDate = new Date(date);
  const joinDate = new Date(earliestJoin);
  const totalMonths = (snapshotDate.getFullYear() - joinDate.getFullYear()) * 12
    + (snapshotDate.getMonth() - joinDate.getMonth()) + 1;
  const totalExpected = requiredAmount * Math.max(totalMonths, 0);

  // 5. Calculate each member's share of portfolio
  const memberSnapshots = [];
  for (const m of members) {
    const mc = memberContributions[m.id] || { totalInvested: 0, netContribution: 0 };

    const share = totalClubContributions > 0 ? mc.netContribution / totalClubContributions : 1 / members.length;
    const portfolioValue = totalPortfolioValue * share;

    const avgContribution = totalClubContributions / members.length;
    const advance = mc.netContribution - avgContribution;

    // Arrears: how much this member is behind on required contributions
    const arrears = Math.max(0, totalExpected - mc.totalInvested);

    memberSnapshots.push({
      member_id: m.id,
      date,
      total_invested: mc.totalInvested,
      portfolio_value: Math.round(portfolioValue * 100) / 100,
      advance_contribution: Math.round(advance * 100) / 100,
      contribution_arrears: Math.round(arrears * 100) / 100,
    });
  }

  // 6. Upsert member snapshots (unique constraint on member_id + date)
  const failedMembers = [];
  for (const snap of memberSnapshots) {
    const { error } = await db.from("member_snapshots").upsert(snap, { onConflict: "member_id,date" });
    if (error) failedMembers.push(snap.member_id);
  }
  if (failedMembers.length > 0) {
    return NextResponse.json({ error: `Failed to save ${failedMembers.length} member snapshot(s)` }, { status: 500 });
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

  const { error: snapError } = await db.from("portfolio_snapshots").upsert(portfolioSnap, { onConflict: "date" });
  if (snapError) return NextResponse.json({ error: "Failed to save portfolio snapshot" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    date,
    totalPortfolioValue,
    membersProcessed: memberSnapshots.length,
    assetTotals,
  });
}
