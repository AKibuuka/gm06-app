import { getServiceClient } from "./supabase";

// Shared helper: fetch all club data in 3 queries (investments, members, contributions)
// instead of N+1 queries per member
async function computeClubShares(cutoffDate) {
  const db = getServiceClient();

  // 1. All active investments (1 query)
  const { data: investments } = await db.from("investments").select("*").eq("is_active", true);
  if (!investments?.length) return null;

  let totalPortfolioValue = 0;
  const assetValues = {};
  for (const inv of investments) {
    totalPortfolioValue += inv.current_value || 0;
    assetValues[inv.asset_class] = (assetValues[inv.asset_class] || 0) + (inv.current_value || 0);
  }

  // 2. All active members (1 query)
  const { data: members } = await db.from("members").select("id").eq("is_active", true);
  if (!members?.length) return null;

  // 3. ALL contributions up to cutoff in ONE query
  const { data: allContribs } = await db
    .from("contributions")
    .select("member_id, amount, type")
    .lte("date", cutoffDate);

  // 4. Group in memory
  const memberShares = {};
  for (const m of members) {
    memberShares[m.id] = { net: 0, totalDeposits: 0 };
  }
  for (const c of (allContribs || [])) {
    if (!memberShares[c.member_id]) continue;
    if (c.type === "deposit") {
      memberShares[c.member_id].net += c.amount;
      memberShares[c.member_id].totalDeposits += c.amount;
    }
    if (c.type === "withdrawal") {
      memberShares[c.member_id].net -= c.amount;
    }
  }

  const totalClubContributions = Object.values(memberShares).reduce((s, v) => s + v.net, 0);

  return { investments, totalPortfolioValue, assetValues, members, memberShares, totalClubContributions };
}

// Build a single member's valuation result from pre-computed club data
function buildMemberValuation(memberId, club) {
  const myShare = club.memberShares[memberId];
  if (!myShare) return null;

  const ownershipPct = club.totalClubContributions > 0
    ? myShare.net / club.totalClubContributions
    : 1 / club.members.length;

  const portfolioValue = club.totalPortfolioValue * ownershipPct;

  const allocation = Object.entries(club.assetValues).map(([cls, clsValue]) => {
    const pct = club.totalPortfolioValue > 0 ? (clsValue / club.totalPortfolioValue) * 100 : 0;
    return {
      asset_class: cls,
      club_value: clsValue,
      member_value: portfolioValue * (pct / 100),
      pct: Math.round(pct * 10) / 10,
    };
  });

  const avgContribution = club.members.length > 0 ? club.totalClubContributions / club.members.length : 0;
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
    club_total: club.totalPortfolioValue,
  };
}

// Calculate a single member's real-time portfolio value
export async function getMemberValuation(memberId, asOfDate = null) {
  const cutoff = asOfDate || new Date().toISOString().split("T")[0];
  const club = await computeClubShares(cutoff);
  if (!club) return null;

  return buildMemberValuation(memberId, club);
}

// Get valuations for ALL members (admin use) — uses 3 queries total
export async function getAllMemberValuations() {
  const db = getServiceClient();
  const { data: members } = await db
    .from("members")
    .select("id, name, email, phone, role, monthly_contribution, is_active")
    .eq("is_active", true)
    .order("name");

  if (!members?.length) return [];

  const cutoff = new Date().toISOString().split("T")[0];
  const club = await computeClubShares(cutoff);
  if (!club) return members.map((m) => ({ ...m, valuation: null }));

  return members.map((m) => ({
    ...m,
    valuation: buildMemberValuation(m.id, club),
  }));
}

// Calculate portfolio value at a past point in time using price_history
// Returns { totalValue, investmentValues } or null if no history
export async function getHistoricalPortfolioValue(asOf) {
  const db = getServiceClient();

  // Get all active investments (for their current values as fallback)
  const { data: investments } = await db.from("investments").select("id, current_value").eq("is_active", true);
  if (!investments?.length) return null;

  // Get the latest price_history entry before `asOf` for each investment
  const { data: history } = await db
    .from("price_history")
    .select("investment_id, value, recorded_at")
    .lte("recorded_at", asOf)
    .order("recorded_at", { ascending: false });

  // Group by investment — take the most recent entry for each
  const latestByInvestment = {};
  for (const h of (history || [])) {
    if (!latestByInvestment[h.investment_id]) {
      latestByInvestment[h.investment_id] = h.value;
    }
  }

  // Sum up: use historical value if available, otherwise current value (no price change)
  let totalValue = 0;
  for (const inv of investments) {
    totalValue += latestByInvestment[inv.id] ?? inv.current_value ?? 0;
  }

  return totalValue;
}

// Get daily and weekly gain/loss for the club portfolio
export async function getPortfolioGains() {
  const db = getServiceClient();

  // Current total value
  const { data: investments } = await db.from("investments").select("id, current_value").eq("is_active", true);
  if (!investments?.length) return { daily: null, weekly: null, currentValue: 0 };

  const currentValue = investments.reduce((s, i) => s + (i.current_value || 0), 0);

  const now = new Date();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [dayValue, weekValue] = await Promise.all([
    getHistoricalPortfolioValue(oneDayAgo),
    getHistoricalPortfolioValue(oneWeekAgo),
  ]);

  return {
    currentValue,
    daily: dayValue !== null ? { gain: currentValue - dayValue, pct: dayValue > 0 ? ((currentValue - dayValue) / dayValue * 100) : 0, previous: dayValue } : null,
    weekly: weekValue !== null ? { gain: currentValue - weekValue, pct: weekValue > 0 ? ((currentValue - weekValue) / weekValue * 100) : 0, previous: weekValue } : null,
  };
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
