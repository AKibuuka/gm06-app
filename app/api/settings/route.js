import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/settings — returns all settings
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data } = await db.from("settings").select("key, value");
  const settings = {};
  (data || []).forEach((s) => { settings[s.key] = s.value; });
  return NextResponse.json(settings);
}

// PUT /api/settings — update settings (admin only)
// Body: { ugx_rate: "3750", statement_date: "2026-04-01" }
export async function PUT(request) {
  const session = getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const updates = await request.json();
  const db = getServiceClient();

  for (const [key, value] of Object.entries(updates)) {
    await db.from("settings").upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ ok: true });
}
