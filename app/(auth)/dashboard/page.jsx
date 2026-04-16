import { cookies } from "next/headers";
import { verifyToken, isAdmin as checkAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServiceClient } from "@/lib/supabase";
import { getMemberValuation, getMemberHistory, getPortfolioGains } from "@/lib/valuation";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard — GM06" };

export default async function DashboardPage() {
  // Auth — layout already verified, but we need the session payload
  const cookieStore = await cookies();
  const token = cookieStore.get("gm06_session")?.value;
  if (!token) redirect("/login");
  const session = verifyToken(token);
  if (!session) redirect("/login");

  const db = getServiceClient();
  const admin = checkAdmin(session);

  // ── Fire ALL queries in parallel ──────────────────────────────────
  const promises = [
    /* 0  */ db.from("members").select("id, name, email, phone, role, monthly_contribution, joined_at, mfa_enabled").eq("id", session.id).single(),
    /* 1  */ getMemberValuation(session.id),
    /* 2  */ getPortfolioGains(),
    /* 3  */ getMemberHistory(session.id),
    /* 4  */ db.from("contributions").select("id, amount, type, description, date").eq("member_id", session.id).order("date", { ascending: false }).limit(20),
    /* 5  */ db.from("fines").select("id, amount, reason, date, is_paid").eq("member_id", session.id).order("date", { ascending: false }).limit(20),
    /* 6  */ db.from("portfolio_snapshots").select("date, total_value, total_invested").order("date"),
    /* 7  */ db.from("loans").select("*").eq("member_id", session.id).in("status", ["pending", "approved", "active"]).limit(1).maybeSingle(),
    /* 8  */ db.from("settings").select("key, value").in("key", ["max_loan_pct", "loan_interest_rate", "required_contribution", "contribution_baseline", "contribution_baseline_date"]),
    /* 9  */ db.from("contributions").select("amount, date").eq("member_id", session.id).eq("type", "deposit"),
    /* 10 */ db.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", session.id).eq("is_read", false),
    /* 11 */ db.from("announcements").select("id, title, body, pinned, created_at, author:members(name)").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    // Admin-only queries (null for non-admin)
    /* 12 */ admin ? db.from("investments").select("*").eq("is_active", true) : null,
    /* 13 */ admin ? db.from("members").select("id, name, email, phone, role, monthly_contribution, is_active, joined_at").eq("is_active", true).order("name") : null,
    /* 14 */ admin ? db.from("member_snapshots").select("date").order("date", { ascending: false }).limit(100) : null,
    /* 15 */ admin ? db.from("contributions").select("member_id, amount").eq("type", "deposit") : null,
    /* 16 */ admin ? db.from("contributions").select("id, amount, type, date, members(name)").order("created_at", { ascending: false }).limit(10) : null,
    /* 17 */ admin ? db.from("loans").select("id, amount, status, requested_at, members!loans_member_id_fkey(name)").order("requested_at", { ascending: false }).limit(5) : null,
    /* 18 */ admin ? db.from("fines").select("id, amount, reason, date, members(name)").order("date", { ascending: false }).limit(5) : null,
  ];

  const results = await Promise.all(promises);

  // ── Extract member data ───────────────────────────────────────────
  const member = results[0].data;
  const valuation = results[1];
  const clubGains = results[2];
  const history = results[3];
  const contributions = results[4].data || [];
  const fines = results[5].data || [];
  const clubHistory = results[6].data || [];
  const activeLoan = results[7].data || null;
  const allSettings = results[8].data || [];
  const allDeposits = results[9].data || [];
  const announcements = results[11].data || [];

  // ── Contribution status (same logic as /api/me) ───────────────────
  const settingsMap = {};
  allSettings.forEach((s) => { settingsMap[s.key] = s.value; });

  const now = new Date();
  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;
  const baseline = parseFloat(settingsMap.contribution_baseline) || 0;
  const baselineDate = settingsMap.contribution_baseline_date || "2026-03-31";
  const bd = new Date(baselineDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthsCompleted = Math.max(0, (currentYear - bd.getFullYear()) * 12 + (currentMonth - bd.getMonth()) - 1);
  const totalExpected = baseline + monthsCompleted * requiredAmount;

  const totalPaid = allDeposits.reduce((s, c) => s + c.amount, 0);
  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const nextMonthStart = currentMonth === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 2).padStart(2, "0")}-01`;
  const thisMonthTotal = allDeposits
    .filter((c) => c.date >= currentMonthStart && c.date < nextMonthStart)
    .reduce((s, c) => s + c.amount, 0);

  const totalArrears = Math.max(0, totalExpected - totalPaid);
  const currentMonthRemaining = Math.max(0, requiredAmount - thisMonthTotal);
  const previousArrears = Math.max(0, totalArrears - currentMonthRemaining);
  const contributionDue = requiredAmount > 0 && totalArrears > 0;

  // ── Member gains (scale club gains by ownership) ──────────────────
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

  // ── Assemble member data payload ──────────────────────────────────
  const memberData = {
    member,
    valuation,
    history,
    gains: memberGains,
    club_gains: {
      daily: clubGains.daily ? { gain: Math.round(clubGains.daily.gain), pct: Math.round(clubGains.daily.pct * 100) / 100 } : null,
      weekly: clubGains.weekly ? { gain: Math.round(clubGains.weekly.gain), pct: Math.round(clubGains.weekly.pct * 100) / 100 } : null,
    },
    contributions,
    fines,
    unpaid_fines: fines.filter((f) => !f.is_paid),
    club_history: clubHistory,
    active_loan: activeLoan,
    contribution_status: {
      required: requiredAmount,
      total_expected: totalExpected + requiredAmount,
      total_paid: totalPaid,
      paid_this_month: thisMonthTotal,
      is_due: contributionDue,
      total_arrears: totalArrears,
      current_month_remaining: currentMonthRemaining,
      previous_arrears: previousArrears,
      months_behind: requiredAmount > 0 ? Math.floor(previousArrears / requiredAmount) : 0,
    },
    announcements,
  };

  // ── Admin data ────────────────────────────────────────────────────
  let adminData = null;
  if (admin) {
    const investments = results[12]?.data || [];
    const allMembers = results[13]?.data || [];
    const allSnapDates = results[14]?.data || [];
    const adminAllDeposits = results[15]?.data || [];
    const actContribs = results[16]?.data || [];
    const actLoans = results[17]?.data || [];
    const actFines = results[18]?.data || [];

    // ── Portfolio summary ──
    const portfolioSummary = {};
    let portfolioTotalValue = 0;
    let portfolioTotalCost = 0;
    investments.forEach((inv) => {
      if (!portfolioSummary[inv.asset_class]) portfolioSummary[inv.asset_class] = { value: 0, cost: 0 };
      portfolioSummary[inv.asset_class].value += inv.current_value || 0;
      portfolioSummary[inv.asset_class].cost += inv.cost_basis || 0;
      portfolioTotalValue += inv.current_value || 0;
      portfolioTotalCost += inv.cost_basis || 0;
    });
    for (const cls in portfolioSummary) {
      portfolioSummary[cls].percentage = portfolioTotalValue > 0 ? (portfolioSummary[cls].value / portfolioTotalValue) * 100 : 0;
    }

    // ── Members with snapshots + real-time arrears ──
    let latestDate = null;
    for (const row of allSnapDates) {
      const d = new Date(row.date);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (d.getDate() >= lastDay) { latestDate = row.date; break; }
    }
    if (!latestDate && allSnapDates.length) latestDate = allSnapDates[0].date;

    let snapshotMap = {};
    if (latestDate) {
      // One dependent query — snapshots for the determined date
      const { data: snapshots } = await db.from("member_snapshots").select("*").eq("date", latestDate);
      (snapshots || []).forEach((s) => { snapshotMap[s.member_id] = s; });
    }

    // Arrears from all deposits
    const depositsByMember = {};
    for (const d of adminAllDeposits) {
      depositsByMember[d.member_id] = (depositsByMember[d.member_id] || 0) + d.amount;
    }

    const adminMembers = allMembers.map((m) => {
      const snapshot = snapshotMap[m.id] || null;
      const mTotalPaid = depositsByMember[m.id] || 0;
      const realTimeArrears = Math.max(0, totalExpected - mTotalPaid);
      return {
        ...m,
        snapshot: snapshot ? { ...snapshot, contribution_arrears: Math.round(realTimeArrears * 100) / 100 } : null,
        snapshot_date: latestDate || null,
      };
    });

    // ── Activity feed ──
    const activityItems = [];
    actContribs.forEach((c) => activityItems.push({
      type: "contribution",
      text: `${c.members?.name || "Member"} — ${c.type} of ${Math.round(c.amount).toLocaleString()}`,
      date: c.date,
      icon: "dollar",
    }));
    actLoans.forEach((l) => activityItems.push({
      type: "loan",
      text: `${l.members?.name || "Member"} — loan ${l.status} (${Math.round(l.amount).toLocaleString()})`,
      date: l.requested_at,
      icon: "landmark",
    }));
    actFines.forEach((f) => activityItems.push({
      type: "fine",
      text: `${f.members?.name || "Member"} — fined for ${f.reason}`,
      date: f.date,
      icon: "alert",
    }));
    activityItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    adminData = {
      members: adminMembers,
      portfolio: {
        totalValue: portfolioTotalValue,
        summary: portfolioSummary,
        history: clubHistory, // reuse the same portfolio_snapshots
        gains: {
          daily: clubGains.daily ? { gain: Math.round(clubGains.daily.gain), pct: Math.round(clubGains.daily.pct * 100) / 100 } : null,
          weekly: clubGains.weekly ? { gain: Math.round(clubGains.weekly.gain), pct: Math.round(clubGains.weekly.pct * 100) / 100 } : null,
        },
      },
      activity: activityItems.slice(0, 15),
    };
  }

  // ── Serialize user for client (only safe fields) ──────────────────
  const user = { id: session.id, name: session.name, email: session.email, role: session.role };

  return <DashboardClient user={user} memberData={memberData} adminData={adminData} />;
}
