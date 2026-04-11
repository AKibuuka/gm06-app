import { getServiceClient } from "./supabase";

// Calculate a single member's real-time portfolio value
// This is the CORE function — everything else derives from it
export async function getMemberValuation(memberId, asOfDate = null) {
  const db = getServiceClient();
  const cutoff = asOfDate || new Date().toISOString().split("T")[0];

  // 1. Get all active investments → total portfolio value RIGHT NOW
  const { data: investments } = await db.from("investments").select("*").eq("is_active", true);
  if (!investments?.length) return null;

  let totalPortfolioValue = 0;
  const assetValues = {};
  for (const inv of investments) {
    totalPortfolioValue += inv.current_value || 0;
    assetValues[inv.asset_class] = (assetValues[inv.asset_class] || 0) + (inv.current_value || 0);
  }

  // 2. Get ALL active members
  const { data: members } = await db.from("members").select("id").eq("is_active", true);
  if (!members?.length) return null;

  // 3. For each member, sum up their net contributions (deposits - withdrawals)
  const memberShares = {};
  let totalClubContributions = 0;

  for (const m of members) {
    const { data: contribs } = await db
      .from("contributions")
      .select("amount, type")
      .eq("member_id", m.id)
      .lte("date", cutoff);

    let net = 0;
    let totalDeposits = 0;
    (contribs || []).forEach((c) => {
      if (c.type === "deposit") { net += c.amount; totalDeposits += c.amount; }
      if (c.type === "withdrawal") net -= c.amount;
    });

    memberShares[m.id] = { net, totalDeposits };
    totalClubContributions += net;
  }

  // 4. This member's share
  const myShare = memberShares[memberId];
  if (!myShare) return null;

  const ownershipPct = totalClubContributions > 0
    ? myShare.net / totalClubContributions
    : 1 / members.length;

  const portfolioValue = totalPortfolioValue * ownershipPct;

  // 5. Build asset-class allocation (same % as club, applied to member's value)
  const allocation = Object.entries(assetValues).map(([cls, clsValue]) => {
    const pct = totalPortfolioValue > 0 ? (clsValue / totalPortfolioValue) * 100 : 0;
    return {
      asset_class: cls,
      club_value: clsValue,
      member_value: portfolioValue * (pct / 100),
      pct: Math.round(pct * 10) / 10,
    };
  });

  // 6. Advance contribution (how far ahead/behind the average)
  const avgContribution = totalClubContributions / members.length;
  const advance = myShare.net - avgContribution;

  return {
    portfolio_value: Math.round(portfolioValue * 100) / 100,
    total_invested: myShare.totalDeposits,
    total_gain: Math.round((portfolioValue - myShare.totalDeposits) * 100) / 100,
    return_pct: myShare.totalDeposits > 0
      ? Math.round(((portfolioValue - myShare.totalDeposits) / myShare.totalDeposits) * 10000) / 100
      : 0,
    ownership_pct: Math.round(ownershipPct * 10000) / 100,
    advance_contribution: Math.round(advance * 100) / 100,
    allocation,
    club_total: totalPortfolioValue,
  };
}

// Get valuations for ALL members (admin use)
export async function getAllMemberValuations() {
  const db = getServiceClient();
  const { data: members } = await db
    .from("members")
    .select("id, name, email, phone, role, monthly_contribution, is_active")
    .eq("is_active", true)
    .order("name");

  if (!members?.length) return [];

  const results = [];
  for (const m of members) {
    const val = await getMemberValuation(m.id);
    results.push({ ...m, valuation: val });
  }
  return results;
}

// Get a member's valuation history (from snapshots)
export async function getMemberHistory(memberId) {
  const db = getServiceClient();
  const { data } = await db
    .from("member_snapshots")
    .select("date, total_invested, portfolio_value, advance_contribution")
    .eq("member_id", memberId)
    .order("date");
  return data || [];
}
