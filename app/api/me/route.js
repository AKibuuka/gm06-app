import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getMemberValuation, getMemberHistory } from "@/lib/valuation";

// GET /api/me — everything the logged-in member needs
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();

  // Member profile
  const { data: member } = await db
    .from("members")
    .select("id, name, email, phone, role, monthly_contribution, joined_at")
    .eq("id", session.id)
    .single();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Real-time valuation
  const valuation = await getMemberValuation(session.id);

  // Valuation history (for chart)
  const history = await getMemberHistory(session.id);

  // Recent contributions
  const { data: contributions } = await db
    .from("contributions")
    .select("id, amount, type, description, date")
    .eq("member_id", session.id)
    .order("date", { ascending: false })
    .limit(20);

  // Outstanding fines
  const { data: fines } = await db
    .from("fines")
    .select("id, amount, reason, date, is_paid")
    .eq("member_id", session.id)
    .order("date", { ascending: false })
    .limit(20);

  const unpaidFines = (fines || []).filter((f) => !f.is_paid);

  return NextResponse.json({
    member,
    valuation,
    history,
    contributions: contributions || [],
    fines: fines || [],
    unpaid_fines: unpaidFines,
  });
}
