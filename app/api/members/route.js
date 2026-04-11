import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin, hashPassword, generateDefaultPassword } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

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

  // Get the LATEST snapshot date dynamically
  const { data: latestSnap } = await db
    .from("member_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestDate = latestSnap?.date;

  let snapshotMap = {};
  if (latestDate) {
    const { data: snapshots } = await db
      .from("member_snapshots")
      .select("*")
      .eq("date", latestDate);
    (snapshots || []).forEach((s) => { snapshotMap[s.member_id] = s; });
  }

  // Filter: admin sees all, member sees only self
  const result = members
    .filter((m) => isAdmin(session) || m.id === session.id)
    .map((m) => ({
      ...m,
      snapshot: snapshotMap[m.id] || null,
      snapshot_date: latestDate || null,
    }));

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

  // Generate default password: gm06-{last4digits of phone}
  const defaultPwd = generateDefaultPassword(phone);
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

  return NextResponse.json({ ...data, default_password: defaultPwd });
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Don't allow updating password_hash through this endpoint
  delete updates.password_hash;

  const db = getServiceClient();
  const { data, error } = await db.from("members")
    .update(updates)
    .eq("id", id)
    .select("id, name, email, phone, role, monthly_contribution, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
  return NextResponse.json({ ok: true });
}
