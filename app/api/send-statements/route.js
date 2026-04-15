import { NextResponse } from "next/server";
export const maxDuration = 60;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { getStatementData } from "@/lib/statement-data";
import { generateStatementPDF } from "@/lib/pdf-statement";
import { Resend } from "resend";
import { CLUB_FULL_NAME } from "@/lib/constants";

// POST /api/send-statements — send PDF statements to all members (admin only)
// Body: { date: "2026-03-31" }
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured. Set RESEND_API_KEY." }, { status: 500 });
  }

  const { date } = await request.json();
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const db = getServiceClient();
  const resend = new Resend(apiKey);

  // Get all active members with emails
  const { data: members } = await db
    .from("members")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  if (!members?.length) return NextResponse.json({ error: "No active members" }, { status: 400 });

  const results = { sent: 0, failed: 0, skipped: 0, errors: [] };

  for (const m of members) {
    if (!m.email) { results.skipped++; continue; }

    try {
      const statementData = await getStatementData(m.id, date);
      if (!statementData?.snapshot) {
        results.skipped++;
        continue;
      }

      const pdfBuffer = await generateStatementPDF(statementData);
      const monthLabel = new Date(date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const firstName = m.name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");

      await resend.emails.send({
        from: `${CLUB_FULL_NAME} <statements@${process.env.RESEND_DOMAIN || "resend.dev"}>`,
        to: m.email,
        subject: `Your ${monthLabel} Portfolio Statement — ${CLUB_FULL_NAME}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
            <h2 style="color:#0d9488">Your Portfolio Statement</h2>
            <p>Hi ${firstName},</p>
            <p>Please find attached your portfolio statement for <strong>${monthLabel}</strong>.</p>
            <p style="background:#f0fdfa;padding:12px;border-radius:6px;text-align:center">
              <strong>Portfolio Value: USh${Math.round(statementData.snapshot.portfolio_value).toLocaleString()}</strong>
            </p>
            <p style="font-size:12px;color:#666">This is an automated statement from ${CLUB_FULL_NAME}. For questions, contact the Treasurer.</p>
          </div>
        `,
        attachments: [{
          filename: `GM06_Statement_${date}_${m.name.replace(/\s+/g, "_")}.pdf`,
          content: pdfBuffer,
        }],
      });

      results.sent++;
    } catch (err) {
      results.failed++;
      results.errors.push({ member: m.name, error: err.message });
    }
  }

  return NextResponse.json(results);
}
