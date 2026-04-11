import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { calculateTotalDue, isOverdue } from "@/lib/loans";

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

  // Loan auto-deduction: deposits first clear any active loan
  if (type === "deposit") {
    const { data: activeLoan } = await db
      .from("loans")
      .select("*")
      .eq("member_id", member_id)
      .eq("status", "active")
      .maybeSingle();

    if (activeLoan) {
      const currentDue = calculateTotalDue(activeLoan);
      const remaining = Math.max(0, currentDue - activeLoan.amount_paid);
      const depositAmount = parseFloat(amount);
      const overdue = isOverdue(activeLoan);

      // Loan payment: min of deposit and remaining balance
      const loanPayment = Math.min(depositAmount, remaining);
      // If overdue: no excess goes to portfolio (all to loan). If current: excess is a normal contribution.
      const excess = overdue ? 0 : Math.max(0, Math.round((depositAmount - loanPayment) * 100) / 100);

      // Record loan payment
      await db.from("loan_payments").insert({
        loan_id: activeLoan.id,
        member_id,
        amount: Math.min(loanPayment, remaining),
        source: "contribution",
        contribution_id: data.id,
        note: overdue ? `Overdue loan recovery from deposit of ${depositAmount}` : `Auto-deducted from deposit of ${depositAmount}`,
      });

      // Update loan
      const newAmountPaid = Math.round((activeLoan.amount_paid + loanPayment) * 100) / 100;
      const loanPaid = newAmountPaid >= currentDue;

      await db.from("loans").update({
        amount_paid: newAmountPaid,
        total_due: currentDue,
        ...(loanPaid ? { status: "paid", paid_at: new Date().toISOString() } : {}),
      }).eq("id", activeLoan.id);

      // Adjust contribution: only the excess counts as a real contribution
      if (excess > 0) {
        await db.from("contributions").update({
          amount: excess,
          description: `${description || "Deposit"} (${Math.round(loanPayment).toLocaleString()} applied to loan)`,
        }).eq("id", data.id);
      } else {
        await db.from("contributions").update({
          amount: 0,
          description: `Full deposit of ${Math.round(depositAmount).toLocaleString()} applied to loan repayment`,
        }).eq("id", data.id);
      }

      // Return updated data
      const { data: updated } = await db.from("contributions").select("*, members(name)").eq("id", data.id).single();
      return NextResponse.json({
        ...(updated || data),
        loan_deduction: { loan_id: activeLoan.id, amount_applied: loanPayment, loan_remaining: remaining - loanPayment, loan_paid: loanPaid, excess },
      });
    }
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
