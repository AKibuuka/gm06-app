import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

// GET /api/settings — returns all settings (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const db = getServiceClient();
  const { data } = await db.from("settings").select("key, value");
  const settings = {};
  (data || []).forEach((s) => { settings[s.key] = s.value; });
  return NextResponse.json(settings);
}

// PUT /api/settings — update settings (admin only)
// Body: { ugx_rate: "3750", statement_date: "2026-04-01" }
const ALLOWED_SETTINGS = [
  "ugx_rate", "club_name", "statement_date", "monthly_target",
  "required_contribution", "max_loan_pct", "loan_interest_rate",
];

export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const updates = await request.json();
  const db = getServiceClient();

  const rejected = Object.keys(updates).filter(k => !ALLOWED_SETTINGS.includes(k));
  if (rejected.length > 0) {
    return NextResponse.json({ error: `Invalid setting keys: ${rejected.join(", ")}` }, { status: 400 });
  }

  // Validate numeric settings
  const NUMERIC_KEYS = ["ugx_rate", "monthly_target", "required_contribution", "max_loan_pct", "loan_interest_rate"];
  for (const key of NUMERIC_KEYS) {
    if (updates[key] !== undefined && (isNaN(parseFloat(updates[key])) || parseFloat(updates[key]) < 0)) {
      return NextResponse.json({ error: `${key} must be a valid positive number` }, { status: 400 });
    }
  }

  // Fetch old values for audit
  const { data: oldSettings } = await db.from("settings").select("key, value").in("key", Object.keys(updates));
  const oldMap = {};
  (oldSettings || []).forEach((s) => { oldMap[s.key] = s.value; });

  for (const [key, value] of Object.entries(updates)) {
    await db.from("settings").upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  await logAudit(session.id, "update", "setting", null, { before: oldMap, after: updates });
  return NextResponse.json({ ok: true });
}
