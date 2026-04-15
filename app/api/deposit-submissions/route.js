import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

// GET /api/deposit-submissions — members see their own, admins see all
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = getServiceClient();
  let query = db.from("deposit_submissions").select("*, members(name)").order("created_at", { ascending: false });

  if (!isAdmin(session)) {
    query = query.eq("member_id", session.id);
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}

// POST /api/deposit-submissions — any member can submit a deposit for review
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, date, bank_ref, receipt_url, notes } = await request.json();

  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (date > new Date().toISOString().split("T")[0]) {
    return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
  }

  const db = getServiceClient();

  // Check for duplicate pending submission with same bank_ref
  if (bank_ref) {
    const { data: existing } = await db
      .from("deposit_submissions")
      .select("id")
      .eq("bank_ref", bank_ref)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "A pending submission with this bank reference already exists" }, { status: 400 });
    }
  }

  const { data, error } = await db.from("deposit_submissions").insert({
    member_id: session.id,
    amount: parseFloat(amount),
    date,
    bank_ref: bank_ref || null,
    receipt_url: receipt_url || null,
    notes: notes || null,
  }).select("*, members(name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}

// PUT /api/deposit-submissions — admin approves or rejects
export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id, action, rejection_reason } = await request.json();
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve/reject) are required" }, { status: 400 });
  }

  const db = getServiceClient();

  const { data: sub } = await db.from("deposit_submissions").select("*").eq("id", id).single();
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (sub.status !== "pending") return NextResponse.json({ error: "Submission already processed" }, { status: 400 });

  if (action === "reject") {
    const { data, error } = await db.from("deposit_submissions").update({
      status: "rejected",
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejection_reason || null,
    }).eq("id", id).select("*, members(name)").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit(session.id, "reject", "deposit_submission", id, { member_id: sub.member_id, amount: sub.amount });
    return NextResponse.json(data);
  }

  // Approve: create a real contribution
  const { data: contribution, error: contribError } = await db.from("contributions").insert({
    member_id: sub.member_id,
    amount: sub.amount,
    type: "deposit",
    description: sub.notes || "Member-submitted deposit",
    bank_ref: sub.bank_ref || null,
    receipt_url: sub.receipt_url || null,
    date: sub.date,
  }).select("*, members(name)").single();

  if (contribError) {
    if (contribError.code === "23505" && contribError.message?.includes("bank_ref")) {
      return NextResponse.json({ error: "A contribution with this bank reference already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: contribError.message }, { status: 500 });
  }

  // Update submission as approved
  const { data, error } = await db.from("deposit_submissions").update({
    status: "approved",
    reviewed_by: session.id,
    reviewed_at: new Date().toISOString(),
    contribution_id: contribution.id,
  }).eq("id", id).select("*, members(name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(session.id, "approve", "deposit_submission", id, {
    member_id: sub.member_id,
    amount: sub.amount,
    contribution_id: contribution.id,
  });

  return NextResponse.json({ ...data, contribution });
}
