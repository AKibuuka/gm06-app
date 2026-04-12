import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

// GET /api/meeting-notes
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data, error } = await db
    .from("meeting_notes")
    .select("*, author:members!created_by(name)")
    .order("meeting_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/meeting-notes — admin creates meeting notes
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { title, body, meeting_date } = await request.json();
  if (!title?.trim() || !body?.trim() || !meeting_date) {
    return NextResponse.json({ error: "Title, body, and date are required" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db.from("meeting_notes").insert({
    title: title.trim(),
    body: body.trim(),
    meeting_date,
    created_by: session.id,
  }).select("*, author:members!created_by(name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "create", "meeting_note", data.id, { title, meeting_date });
  return NextResponse.json(data);
}

// DELETE /api/meeting-notes — admin deletes
export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await request.json();
  const db = getServiceClient();
  const { error } = await db.from("meeting_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "delete", "meeting_note", id, {});
  return NextResponse.json({ ok: true });
}
