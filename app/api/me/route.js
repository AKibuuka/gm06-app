import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getMemberValuation, getMemberHistory, getPortfolioGains } from "@/lib/valuation";

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

  // Daily/weekly portfolio gains (club-level, scaled by member ownership)
  const clubGains = await getPortfolioGains();

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

  // Contribution status: calculate accumulated arrears + current month
  const now = new Date();
  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;

  // Calculate total months of expected contributions since member joined
  const joinedDate = new Date(member.joined_at);
  const joinYear = joinedDate.getFullYear();
  const joinMonth = joinedDate.getMonth(); // 0-based
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  // Total months including the current month
  const totalMonths = (currentYear - joinYear) * 12 + (currentMonth - joinMonth) + 1;

  // Total expected contributions
  const totalExpected = requiredAmount * Math.max(totalMonths, 0);

  // Total deposits ever made by this member
  const { data: allDeposits } = await db
    .from("contributions")
    .select("amount, date")
    .eq("member_id", session.id)
    .eq("type", "deposit");

  const totalPaid = (allDeposits || []).reduce((s, c) => s + c.amount, 0);

  // Current month deposits
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const nextMonthStart = currentMonth === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`;
  const thisMonthTotal = (allDeposits || [])
    .filter((c) => c.date >= currentMonthStart && c.date < nextMonthStart)
    .reduce((s, c) => s + c.amount, 0);

  // Arrears breakdown
  const totalArrears = Math.max(0, totalExpected - totalPaid); // total amount behind
  const currentMonthRemaining = Math.max(0, requiredAmount - thisMonthTotal); // what's left this month
  const previousArrears = Math.max(0, totalArrears - currentMonthRemaining); // accumulated from past months
  const contributionDue = requiredAmount > 0 && totalArrears > 0;

  // Unread messages count
  const { count: unreadMessages } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", session.id)
    .eq("is_read", false);

  // Latest announcements (last 5)
  const { data: announcements } = await db
    .from("announcements")
    .select("id, title, body, pinned, created_at, author:members(name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  // Scale club gains by member ownership % for member-level daily/weekly
  const ownershipFraction = valuation?.ownership_pct ? valuation.ownership_pct / 100 : 0;
  const memberGains = {
    daily: clubGains.daily ? {
      gain: Math.round(clubGains.daily.gain * ownershipFraction * 100) / 100,
      pct: Math.round(clubGains.daily.pct * 100) / 100,
    } : null,
    weekly: clubGains.weekly ? {
      gain: Math.round(clubGains.weekly.gain * ownershipFraction * 100) / 100,
      pct: Math.round(clubGains.weekly.pct * 100) / 100,
    } : null,
  };

  return NextResponse.json({
    member,
    valuation,
    history,
    gains: memberGains,
    club_gains: {
      daily: clubGains.daily ? { gain: Math.round(clubGains.daily.gain), pct: Math.round(clubGains.daily.pct * 100) / 100 } : null,
      weekly: clubGains.weekly ? { gain: Math.round(clubGains.weekly.gain), pct: Math.round(clubGains.weekly.pct * 100) / 100 } : null,
    },
    contributions: contributions || [],
    fines: fines || [],
    unpaid_fines: unpaidFines,
    club_history: clubHistory || [],
    active_loan: activeLoan || null,
    loan_settings: { max_loan_pct: settingsMap.max_loan_pct, loan_interest_rate: settingsMap.loan_interest_rate },
    required_contribution: requiredAmount,
    contribution_status: {
      required: requiredAmount,
      paid_this_month: thisMonthTotal,
      is_due: contributionDue,
      total_arrears: totalArrears,
      current_month_remaining: currentMonthRemaining,
      previous_arrears: previousArrears,
      months_behind: requiredAmount > 0 ? Math.floor(previousArrears / requiredAmount) : 0,
    },
    unread_messages: unreadMessages || 0,
    announcements: announcements || [],
  });
}
