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
    .select("id, name, email, phone, role, monthly_contribution, joined_at, mfa_enabled")
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

  // Club history for club overview tab
  const { data: clubHistory } = await db
    .from("portfolio_snapshots")
    .select("date, total_value, total_invested")
    .order("date");

  // Active loan
  const { data: activeLoan } = await db
    .from("loans")
    .select("*")
    .eq("member_id", session.id)
    .in("status", ["pending", "approved", "active"])
    .limit(1)
    .maybeSingle();

  // Settings (loan + contribution)
  const { data: allSettings } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["max_loan_pct", "loan_interest_rate", "required_contribution"]);
  const settingsMap = {};
  (allSettings || []).forEach((s) => { settingsMap[s.key] = s.value; });

  // Contribution status: check if member has contributed this month
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonthStart = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

  const { data: thisMonthContribs } = await db
    .from("contributions")
    .select("amount")
    .eq("member_id", session.id)
    .eq("type", "deposit")
    .gte("date", currentMonthStart)
    .lt("date", nextMonthStart);

  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;
  const thisMonthTotal = (thisMonthContribs || []).reduce((s, c) => s + c.amount, 0);
  const contributionDue = requiredAmount > 0 && thisMonthTotal < requiredAmount;

  // Unread messages count
  const { count: unreadMessages } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", session.id)
    .eq("is_read", false);

  // Latest announcements (last 5)
  const { data: announcements } = await db
    .from("announcements")
    .select("id, title, body, pinned, created_at, members!announcements_author_id_fkey(name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    member,
    valuation,
    history,
    contributions: contributions || [],
    fines: fines || [],
    unpaid_fines: unpaidFines,
    club_history: clubHistory || [],
    active_loan: activeLoan || null,
    loan_settings: { max_loan_pct: settingsMap.max_loan_pct, loan_interest_rate: settingsMap.loan_interest_rate },
    required_contribution: requiredAmount,
    contribution_status: { required: requiredAmount, paid_this_month: thisMonthTotal, is_due: contributionDue },
    unread_messages: unreadMessages || 0,
    announcements: announcements || [],
  });
}
