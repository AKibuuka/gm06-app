import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("member_id");
  const unpaidOnly = searchParams.get("unpaid") === "true";

  const db = getServiceClient();
  let query = db.from("fines").select("*, members(name)").order("date", { ascending: false });

  if (!isAdmin(session)) query = query.eq("member_id", session.id);
  else if (memberId) query = query.eq("member_id", memberId);
  if (unpaidOnly) query = query.eq("is_paid", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { member_id, amount, reason, date } = await request.json();
  if (!member_id || !amount || !reason) return NextResponse.json({ error: "member_id, amount, reason required" }, { status: 400 });

  const db = getServiceClient();

  // Insert fine record
  const { data: fine, error: fineErr } = await db.from("fines").insert({
    member_id, amount: parseFloat(amount), reason, date: date || new Date().toISOString().split("T")[0],
  }).select("*, members(name)").single();
  if (fineErr) return NextResponse.json({ error: fineErr.message }, { status: 400 });

  // Also record as a contribution of type 'fine' (income to the club)
  await db.from("contributions").insert({
    member_id, amount: parseFloat(amount), type: "fine", description: `Fine: ${reason}`, date: date || new Date().toISOString().split("T")[0],
  });

  await logAudit(session.id, "create", "fine", fine.id, { member_id, amount: parseFloat(amount), reason });
  return NextResponse.json(fine);
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id, is_paid } = await request.json();
  const db = getServiceClient();
  const { data, error } = await db.from("fines").update({ is_paid }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "update", "fine", id, { is_paid });
  return NextResponse.json(data);
}
