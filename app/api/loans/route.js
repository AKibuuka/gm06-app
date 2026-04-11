import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getMemberValuation } from "@/lib/valuation";
import { calculateTotalDue, calculateRemaining, getDueDate, isOverdue, calculateTotalWithInterest } from "@/lib/loans";

// GET /api/loans?status=pending&member_id=xxx
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const memberId = searchParams.get("member_id");

  const db = getServiceClient();
  let query = db
    .from("loans")
    .select("*, members!loans_member_id_fkey(name), approver1:members!fk_approved_by_1(name), approver2:members!fk_approved_by_2(name), loan_payments(id, amount, created_at, note)")
    .order("requested_at", { ascending: false });

  if (!isAdmin(session)) {
    query = query.eq("member_id", session.id);
  } else if (memberId) {
    query = query.eq("member_id", memberId);
  }

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data || []).map((loan) => ({
    ...loan,
    calculated_total_due: calculateTotalDue(loan),
    remaining: calculateRemaining(loan),
    due_date: getDueDate(loan)?.toISOString().split("T")[0] || null,
    is_overdue: isOverdue(loan),
  }));

  return NextResponse.json(enriched);
}

// POST /api/loans — member requests a loan
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, reason } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  const db = getServiceClient();

  // Check no existing active loan
  const { data: existing } = await db
    .from("loans")
    .select("id")
    .eq("member_id", session.id)
    .in("status", ["pending", "approved", "active"])
    .limit(1);

  if (existing?.length > 0) {
    return NextResponse.json({ error: "You already have an active or pending loan" }, { status: 400 });
  }

  // Get portfolio value and settings
  const valuation = await getMemberValuation(session.id);
  if (!valuation) return NextResponse.json({ error: "No portfolio data available" }, { status: 400 });

  const { data: settings } = await db.from("settings").select("key, value").in("key", ["max_loan_pct", "loan_interest_rate"]);
  const settingsMap = {};
  (settings || []).forEach((s) => { settingsMap[s.key] = s.value; });

  const maxPct = parseFloat(settingsMap.max_loan_pct) || 80;
  const interestRate = parseFloat(settingsMap.loan_interest_rate) || 10;
  const maxAmount = valuation.portfolio_value * (maxPct / 100);

  if (amount > maxAmount) {
    return NextResponse.json({ error: `Maximum loan amount is ${Math.floor(maxAmount).toLocaleString()} (${maxPct}% of your portfolio)` }, { status: 400 });
  }

  // total_due is set to amount only at request time — interest added at activation
  const { data: loan, error } = await db.from("loans").insert({
    member_id: session.id,
    amount: parseFloat(amount),
    interest_rate: interestRate,
    total_due: parseFloat(amount),
    status: "pending",
    reason: reason || null,
  }).select("*").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have an active or pending loan" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(loan);
}

// PUT /api/loans — admin approve/reject
export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, notes } = await request.json();
  if (!id || !action) return NextResponse.json({ error: "id and action are required" }, { status: 400 });

  if (!isAdmin(session) && action !== "cancel") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getServiceClient();
  const { data: loan } = await db.from("loans").select("*").eq("id", id).single();
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  if (action === "approve") {
    if (loan.status !== "pending") {
      return NextResponse.json({ error: "Only pending loans can be approved" }, { status: 400 });
    }

    // First approval
    if (!loan.approved_by_1) {
      const { data, error } = await db.from("loans")
        .update({ approved_by_1: session.id })
        .eq("id", id)
        .is("approved_by_1", null)
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ...data, message: "First approval recorded (1/2)" });
    }

    // Second approval — cannot be the same admin
    if (loan.approved_by_1 === session.id) {
      return NextResponse.json({ error: "You already approved this loan. A different admin must provide the second approval." }, { status: 400 });
    }

    // Activate: calculate total_due with flat quarterly interest
    const totalDue = calculateTotalWithInterest(loan.amount, loan.interest_rate);
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + 3);

    const { data, error } = await db.from("loans")
      .update({
        approved_by_2: session.id,
        status: "active",
        total_due: totalDue,
        approved_at: now.toISOString(),
        activated_at: now.toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, message: "Loan activated (2/2 approvals)" });
  }

  if (action === "reject") {
    if (!["pending"].includes(loan.status)) {
      return NextResponse.json({ error: "Only pending loans can be rejected" }, { status: 400 });
    }

    const { data, error } = await db.from("loans")
      .update({ status: "rejected", rejected_at: new Date().toISOString(), notes: notes || null })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "cancel") {
    if (loan.member_id !== session.id) return NextResponse.json({ error: "You can only cancel your own loan" }, { status: 403 });
    if (loan.status !== "pending") return NextResponse.json({ error: "Only pending loans can be cancelled" }, { status: 400 });

    const { data, error } = await db.from("loans")
      .update({ status: "rejected", rejected_at: new Date().toISOString(), notes: "Cancelled by member" })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
