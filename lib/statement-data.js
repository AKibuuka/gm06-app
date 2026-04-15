import { getServiceClient } from "@/lib/supabase";
import { ASSET_CLASS_LABELS } from "@/lib/format";
import { CLUB_FULL_NAME } from "@/lib/constants";

/**
 * Fetch full statement data for a member at a given date.
 * Shared between the /api/statements route and the PDF email sender.
 */
export async function getStatementData(memberId, date) {
  const db = getServiceClient();

  if (!date) {
    const { data: latestSnap } = await db
      .from("member_snapshots")
      .select("date")
      .eq("member_id", memberId)
      .order("date", { ascending: false })
      .limit(1)
      .single();
    date = latestSnap?.date || new Date().toISOString().split("T")[0];
  }

  const { data: member } = await db.from("members").select("id, name, email, phone, monthly_contribution").eq("id", memberId).single();
  if (!member) return null;

  const { data: snapshot } = await db.from("member_snapshots").select("*").eq("member_id", memberId).eq("date", date).single();
  const { data: portfolioSnap } = await db.from("portfolio_snapshots").select("*").eq("date", date).single();

  const { data: contributions } = await db
    .from("contributions")
    .select("*")
    .eq("member_id", memberId)
    .lte("date", date)
    .order("date", { ascending: false });

  let allocation = [];
  if (portfolioSnap && snapshot) {
    const totalPV = portfolioSnap.total_value || 1;
    const classKeys = ["fixed_income", "stocks", "digital_assets", "real_estate", "private_equity", "loans", "cash"];
    allocation = classKeys.map((key) => {
      const value = portfolioSnap[`${key}_value`] || 0;
      const pct = (value / totalPV) * 100;
      const memberValue = snapshot.portfolio_value * (pct / 100);
      return { asset: ASSET_CLASS_LABELS[key] || key, pct: Math.round(pct * 10) / 10, value: Math.round(memberValue * 100) / 100 };
    });
  }

  return {
    member: { id: member.id, name: member.name, phone: member.phone, email: member.email, monthly_contribution: member.monthly_contribution },
    snapshot,
    allocation,
    contributions: contributions || [],
    date,
    club: { name: CLUB_FULL_NAME },
  };
}
