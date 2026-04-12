import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getMemberValuation } from "@/lib/valuation";
import { logAudit } from "@/lib/audit";

// GET /api/withdrawals
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  let query = db.from("withdrawal_requests")
    .select("*, members(name)")
    .order("created_at", { ascending: false });

  if (!isAdmin(session)) query = query.eq("member_id", session.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/withdrawals — member requests withdrawal
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, reason } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  // Check member has enough portfolio value
  const valuation = await getMemberValuation(session.id);
  if (!valuation) return NextResponse.json({ error: "No portfolio data available" }, { status: 400 });
  if (amount > valuation.portfolio_value) {
    return NextResponse.json({ error: `Amount exceeds your portfolio value of ${Math.floor(valuation.portfolio_value).toLocaleString()}` }, { status: 400 });
  }

  const db = getServiceClient();

  // Check no pending withdrawal
  const { data: existing } = await db.from("withdrawal_requests").select("id").eq("member_id", session.id).eq("status", "pending").limit(1);
  if (existing?.length > 0) return NextResponse.json({ error: "You already have a pending withdrawal request" }, { status: 400 });

  const { data, error } = await db.from("withdrawal_requests").insert({
    member_id: session.id,
    amount: parseFloat(amount),
    reason: reason || null,
  }).select("*, members(name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// PUT /api/withdrawals — admin approve/reject/complete
export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id, action, notes } = await request.json();
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });

  const db = getServiceClient();
  const { data: wr } = await db.from("withdrawal_requests").select("*").eq("id", id).single();
  if (!wr) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (action === "approve" && wr.status === "pending") {
    const { data, error } = await db.from("withdrawal_requests").update({
      status: "approved", approved_by: session.id, approved_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAudit(session.id, "approve", "withdrawal", id, { member_id: wr.member_id, amount: wr.amount });
    return NextResponse.json(data);
  }

  if (action === "complete" && wr.status === "approved") {
    // Record as withdrawal contribution
    await db.from("contributions").insert({
      member_id: wr.member_id, amount: wr.amount, type: "withdrawal",
      description: `Withdrawal request #${id.slice(0, 8)}`,
      date: new Date().toISOString().split("T")[0],
    });
    const { data, error } = await db.from("withdrawal_requests").update({
      status: "completed", completed_at: new Date().toISOString(), notes: notes || null,
    }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAudit(session.id, "complete", "withdrawal", id, { member_id: wr.member_id, amount: wr.amount });
    return NextResponse.json(data);
  }

  if (action === "reject" && wr.status === "pending") {
    const { data, error } = await db.from("withdrawal_requests").update({
      status: "rejected", rejected_at: new Date().toISOString(), notes: notes || null,
    }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAudit(session.id, "reject", "withdrawal", id, { member_id: wr.member_id, amount: wr.amount, notes: notes || null });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action for current status" }, { status: 400 });
}
