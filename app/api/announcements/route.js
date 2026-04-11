import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/announcements — list all announcements
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data, error } = await db
    .from("announcements")
    .select("*, members!announcements_author_id_fkey(name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/announcements — admin creates announcement
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { title, body, pinned } = await request.json();
  if (!title || !body) return NextResponse.json({ error: "Title and body are required" }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db.from("announcements").insert({
    author_id: session.id,
    title,
    body,
    pinned: pinned || false,
  }).select("*, members!announcements_author_id_fkey(name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE /api/announcements — admin deletes announcement
export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await request.json();
  const db = getServiceClient();
  const { error } = await db.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
