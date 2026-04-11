import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/messages — list conversations or messages with a specific member
// ?with=member_id — get conversation with specific member
// (no params) — get conversation list (latest message per conversation)
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const withMemberId = searchParams.get("with");
  const db = getServiceClient();

  if (withMemberId) {
    // Get messages in this conversation + mark as read
    const { data, error } = await db
      .from("messages")
      .select("*, sender:members!sender_id(id, name), recipient:members!recipient_id(id, name)")
      .or(`and(sender_id.eq.${session.id},recipient_id.eq.${withMemberId}),and(sender_id.eq.${withMemberId},recipient_id.eq.${session.id})`)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark unread messages from the other person as read
    await db.from("messages")
      .update({ is_read: true })
      .eq("sender_id", withMemberId)
      .eq("recipient_id", session.id)
      .eq("is_read", false);

    return NextResponse.json(data || []);
  }

  // Get conversation list — all members this user has messaged or received from
  // Plus unread count
  const { data: allMessages, error } = await db
    .from("messages")
    .select("id, sender_id, recipient_id, body, is_read, created_at, sender:members!sender_id(id, name), recipient:members!recipient_id(id, name)")
    .or(`sender_id.eq.${session.id},recipient_id.eq.${session.id}`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by conversation partner
  const conversations = {};
  for (const msg of (allMessages || [])) {
    const partnerId = msg.sender_id === session.id ? msg.recipient_id : msg.sender_id;
    if (!conversations[partnerId]) {
      const partner = msg.sender_id === session.id ? msg.recipient : msg.sender;
      conversations[partnerId] = {
        partner_id: partnerId,
        partner_name: partner?.name || "Unknown",
        last_message: msg.body,
        last_message_at: msg.created_at,
        unread: 0,
      };
    }
    if (msg.recipient_id === session.id && !msg.is_read) {
      conversations[partnerId].unread++;
    }
  }

  const sorted = Object.values(conversations).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  return NextResponse.json(sorted);
}

// POST /api/messages — send a message
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipient_id, body } = await request.json();
  if (!recipient_id || !body?.trim()) return NextResponse.json({ error: "Recipient and message are required" }, { status: 400 });
  if (recipient_id === session.id) return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });

  const db = getServiceClient();

  // Verify recipient exists
  const { data: recipient } = await db.from("members").select("id").eq("id", recipient_id).eq("is_active", true).single();
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  const { data, error } = await db.from("messages").insert({
    sender_id: session.id,
    recipient_id,
    body: body.trim(),
  }).select("*, sender:members!messages_sender_id_fkey(id, name)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
