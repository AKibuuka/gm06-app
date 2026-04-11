import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/messages/unread — lightweight unread count for sidebar badge
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ count: 0 });

  const db = getServiceClient();
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", session.id)
    .eq("is_read", false);

  return NextResponse.json({ count: count || 0 });
}
