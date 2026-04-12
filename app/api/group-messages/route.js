import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/group-messages — list group chat messages
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit")) || 100, 500);

  const db = getServiceClient();
  const { data, error } = await db
    .from("group_messages")
    .select("*, sender:members!sender_id(id, name)")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/group-messages — send a group message
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db.from("group_messages").insert({
    sender_id: session.id,
    body: body.trim(),
  }).select("*, sender:members!sender_id(id, name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
