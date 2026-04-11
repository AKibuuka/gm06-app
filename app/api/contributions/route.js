import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/contributions?member_id=xxx&from=2026-01-01&to=2026-03-31
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");

  const db = getServiceClient();
  let query = db.from("contributions").select("*, members(name)").order("date", { ascending: false });

  // Members can only see their own
  if (!isAdmin(session)) {
    query = query.eq("member_id", session.id);
  } else if (memberId) {
    query = query.eq("member_id", memberId);
  }

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (type) query = query.eq("type", type);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/contributions — record a new contribution (admin only)
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { member_id, amount, type, description, date, bank_ref } = body;

  if (!member_id || !amount || !type) {
    return NextResponse.json({ error: "member_id, amount, and type are required" }, { status: 400 });
  }

  if (!["deposit", "fine", "expense", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("contributions")
    .insert({
      member_id,
      amount: parseFloat(amount),
      type,
      description: description || null,
      bank_ref: bank_ref || null,
      date: date || new Date().toISOString().split("T")[0],
    })
    .select("*, members(name)")
    .single();

  if (error) {
    if (error.code === "23505" && error.message?.includes("bank_ref")) {
      return NextResponse.json({ error: `Duplicate bank reference: ${bank_ref} already exists` }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

// DELETE /api/contributions — delete a contribution (admin only)
export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await request.json();
  const db = getServiceClient();
  const { error } = await db.from("contributions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
