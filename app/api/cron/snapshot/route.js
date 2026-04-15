import { NextResponse } from "next/server";
export const maxDuration = 30;
import { getServiceClient } from "@/lib/supabase";

// Vercel Cron Job — runs at 11:55 PM on the last day of every month
// Generates the monthly member + portfolio snapshot automatically
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run on the last day of the month
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() !== lastDay) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Not the last day of the month" });
  }

  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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

  // 3. Fetch ALL contributions up to the date
  const { data: allContribs } = await db
    .from("contributions")
    .select("member_id, amount, type")
    .lte("date", date);

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

  // 4. Calculate total club contributions
  const totalClubContributions = Object.values(memberContributions).reduce((s, c) => s + c.netContribution, 0);

  // 4b. Fetch contribution settings for arrears
  const { data: contribSettings } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["required_contribution", "contribution_baseline", "contribution_baseline_date"]);
  const settingsMap = {};
  (contribSettings || []).forEach((s) => { settingsMap[s.key] = s.value; });

  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;
  const baseline = parseFloat(settingsMap.contribution_baseline) || 0;
  const baselineDate = settingsMap.contribution_baseline_date || "2026-03-31";

  const bd = new Date(baselineDate);
  const sd = new Date(date);
  const monthDiff = (sd.getFullYear() - bd.getFullYear()) * 12 + (sd.getMonth() - bd.getMonth());
  const lastDayOfMonth = new Date(sd.getFullYear(), sd.getMonth() + 1, 0).getDate();
  const monthsAfterBaseline = Math.max(0, sd.getDate() >= lastDayOfMonth ? monthDiff : monthDiff - 1);
  const totalExpected = baseline + monthsAfterBaseline * requiredAmount;

  // 5. Calculate each member's share and arrears
  const memberSnapshots = [];
  for (const m of members) {
    const mc = memberContributions[m.id] || { totalInvested: 0, netContribution: 0 };
    const share = totalClubContributions > 0 ? mc.netContribution / totalClubContributions : 1 / members.length;
    const portfolioValue = totalPortfolioValue * share;
    const avgContribution = totalClubContributions / members.length;
    const advance = mc.netContribution - avgContribution;
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

  // 6. Upsert member snapshots
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
