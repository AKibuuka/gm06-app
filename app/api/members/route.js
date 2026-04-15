import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin, hashPassword, generateDefaultPassword } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();

  const { data: members } = await db
    .from("members")
    .select("id, name, email, phone, role, monthly_contribution, is_active, joined_at")
    .eq("is_active", true)
    .order("name");

  if (!members) return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });

  // Get the latest month-end snapshot date (last day of any month)
  const { data: allSnapDates } = await db
    .from("member_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(100);

  let latestDate = null;
  for (const row of (allSnapDates || [])) {
    const d = new Date(row.date);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() >= lastDay) { latestDate = row.date; break; }
  }
  // Fallback to latest snapshot if no month-end snapshot exists
  if (!latestDate && allSnapDates?.length) latestDate = allSnapDates[0].date;

  let snapshotMap = {};
  if (latestDate) {
    const { data: snapshots } = await db
      .from("member_snapshots")
      .select("*")
      .eq("date", latestDate);
    (snapshots || []).forEach((s) => { snapshotMap[s.member_id] = s; });
  }

  // Compute real-time arrears (snapshot arrears become stale when contributions are recorded after)
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

  // Fetch all deposits for real-time arrears
  const { data: allDeposits } = await db
    .from("contributions")
    .select("member_id, amount")
    .eq("type", "deposit");

  const depositsByMember = {};
  for (const d of (allDeposits || [])) {
    depositsByMember[d.member_id] = (depositsByMember[d.member_id] || 0) + d.amount;
  }

  // Filter: admin sees all, member sees only self
  const result = members
    .filter((m) => isAdmin(session) || m.id === session.id)
    .map((m) => {
      const snapshot = snapshotMap[m.id] || null;
      const totalPaid = depositsByMember[m.id] || 0;
      const realTimeArrears = Math.max(0, totalExpected - totalPaid);
      return {
        ...m,
        snapshot: snapshot ? { ...snapshot, contribution_arrears: Math.round(realTimeArrears * 100) / 100 } : null,
        snapshot_date: latestDate || null,
      };
    });

  return NextResponse.json(result);
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, phone, monthly_contribution, role } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Generate a random default password
  const defaultPwd = generateDefaultPassword();
  const password_hash = await hashPassword(defaultPwd);

  const db = getServiceClient();
  const { data, error } = await db.from("members").insert({
    name: name.toUpperCase(),
    email: email.toLowerCase().trim(),
    phone: phone || null,
    role: role || "member",
    password_hash,
    monthly_contribution: parseFloat(monthly_contribution) || 0,
    is_active: true,
  }).select("id, name, email, phone, role, monthly_contribution, is_active, joined_at").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A member with this email already exists" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(session.id, "create", "member", data.id, { name: data.name, email: data.email, role: data.role });
  return NextResponse.json({ ...data, default_password: defaultPwd });
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Whitelist allowed fields to prevent mass assignment
  const ALLOWED_FIELDS = ["name", "email", "phone", "role", "monthly_contribution", "is_active"];
  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // Validate role if provided
  if (updates.role && !["admin", "member"].includes(updates.role)) {
    return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'member'" }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db.from("members")
    .update(updates)
    .eq("id", id)
    .select("id, name, email, phone, role, monthly_contribution, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "update", "member", id, { updates });
  return NextResponse.json(data);
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await request.json();
  if (id === session.id) return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });

  const db = getServiceClient();
  const { error } = await db.from("members").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "deactivate", "member", id, {});
  return NextResponse.json({ ok: true });
}
