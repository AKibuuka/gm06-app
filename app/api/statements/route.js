import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { ASSET_CLASS_LABELS } from "@/lib/format";
import { CLUB_FULL_NAME } from "@/lib/constants";
export const maxDuration = 15;

// GET /api/statements?member_id=xxx&date=2026-03-01
// Returns full statement data for a member at a given date
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member_id");
  let date = searchParams.get("date");

  if (!memberId) {
    return NextResponse.json({ error: "member_id is required" }, { status: 400 });
  }

  // Members can only get their own statement
  if (!isAdmin(session) && memberId !== session.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // If no date provided, use the latest snapshot date
  if (!date) {
    const db0 = getServiceClient();
    const { data: latestSnap } = await db0
      .from("member_snapshots")
      .select("date")
      .eq("member_id", memberId)
      .order("date", { ascending: false })
      .limit(1)
      .single();
    date = latestSnap?.date || new Date().toISOString().split("T")[0];
  }

  const db = getServiceClient();

  // Get member
  const { data: member } = await db.from("members").select("id, name, email, phone, monthly_contribution").eq("id", memberId).single();
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
    const classKeys = ["fixed_income", "stocks", "digital_assets", "real_estate", "private_equity", "loans", "cash"];
    const classes = classKeys.map((key) => ({
      name: ASSET_CLASS_LABELS[key] || key,
      value: portfolioSnap[`${key}_value`] || 0,
    }));

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
    club: { name: CLUB_FULL_NAME },
  });
}
