import { NextResponse } from "next/server";
export const maxDuration = 30;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";

// GET /api/reminders — list members in arrears with their details
export async function GET(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getServiceClient();

  // Use the same real-time arrears calculation as /api/members
  const { data: members } = await db
    .from("members")
    .select("id, name, phone, email, monthly_contribution")
    .eq("is_active", true);

  const { data: contribSettings } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["required_contribution", "contribution_baseline", "contribution_baseline_date"]);
  const settingsMap = {};
  (contribSettings || []).forEach((s) => { settingsMap[s.key] = s.value; });

  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;
  const baseline = parseFloat(settingsMap.contribution_baseline) || 0;
  const baselineDate = settingsMap.contribution_baseline_date || "2026-03-31";

  const now = new Date();
  const bd = new Date(baselineDate);
  const monthsCompleted = Math.max(0, (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth()) - 1);
  const totalExpected = baseline + monthsCompleted * requiredAmount;

  const { data: allDeposits } = await db
    .from("contributions")
    .select("member_id, amount, date")
    .eq("type", "deposit");

  const depositsByMember = {};
  const lastDepositDate = {};
  for (const d of (allDeposits || [])) {
    depositsByMember[d.member_id] = (depositsByMember[d.member_id] || 0) + d.amount;
    if (!lastDepositDate[d.member_id] || d.date > lastDepositDate[d.member_id]) {
      lastDepositDate[d.member_id] = d.date;
    }
  }

  // Recent reminders
  const { data: recentReminders } = await db
    .from("reminder_log")
    .select("member_id, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const lastReminder = {};
  for (const r of (recentReminders || [])) {
    if (!lastReminder[r.member_id]) lastReminder[r.member_id] = r.created_at;
  }

  const inArrears = (members || [])
    .map((m) => {
      const totalPaid = depositsByMember[m.id] || 0;
      const arrears = Math.max(0, totalExpected - totalPaid);
      if (arrears <= 0) return null;
      return {
        ...m,
        arrears,
        last_deposit: lastDepositDate[m.id] || null,
        last_reminder: lastReminder[m.id] || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.arrears - a.arrears);

  return NextResponse.json(inArrears);
}

// POST /api/reminders — send SMS reminders to selected members
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { member_ids, channel = "sms" } = await request.json();
  if (!member_ids?.length) {
    return NextResponse.json({ error: "member_ids array is required" }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch arrears data (same logic as GET)
  const { data: members } = await db
    .from("members")
    .select("id, name, phone")
    .eq("is_active", true)
    .in("id", member_ids);

  const { data: contribSettings } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["required_contribution", "contribution_baseline", "contribution_baseline_date"]);
  const settingsMap = {};
  (contribSettings || []).forEach((s) => { settingsMap[s.key] = s.value; });

  const requiredAmount = parseFloat(settingsMap.required_contribution) || 0;
  const baseline = parseFloat(settingsMap.contribution_baseline) || 0;
  const baselineDate = settingsMap.contribution_baseline_date || "2026-03-31";

  const now = new Date();
  const bd = new Date(baselineDate);
  const monthsCompleted = Math.max(0, (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth()) - 1);
  const totalExpected = baseline + monthsCompleted * requiredAmount;

  const { data: allDeposits } = await db
    .from("contributions")
    .select("member_id, amount")
    .eq("type", "deposit")
    .in("member_id", member_ids);

  const depositsByMember = {};
  for (const d of (allDeposits || [])) {
    depositsByMember[d.member_id] = (depositsByMember[d.member_id] || 0) + d.amount;
  }

  const results = { sent: 0, failed: 0, errors: [] };

  for (const m of (members || [])) {
    if (!m.phone) { results.failed++; results.errors.push({ member: m.name, error: "No phone number" }); continue; }

    const totalPaid = depositsByMember[m.id] || 0;
    const arrears = Math.max(0, totalExpected - totalPaid);
    const firstName = m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
    const month = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    const message = `Hi ${firstName}, your GM06 contribution arrears stand at USh${Math.round(arrears).toLocaleString()}. Kindly deposit to the club account at your earliest convenience. For questions, contact the Treasurer.`;

    try {
      const smsResult = await sendSMS(m.phone, message);

      await db.from("reminder_log").insert({
        member_id: m.id,
        channel,
        message,
        status: "sent",
        external_id: smsResult.messageId || null,
      });

      results.sent++;
    } catch (err) {
      await db.from("reminder_log").insert({
        member_id: m.id,
        channel,
        message,
        status: "failed",
        error: err.message,
      });

      results.failed++;
      results.errors.push({ member: m.name, error: err.message });
    }
  }

  return NextResponse.json(results);
}
