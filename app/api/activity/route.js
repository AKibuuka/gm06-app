import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/activity — recent club activity feed (admin only)
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const db = getServiceClient();
  const items = [];

  // Recent contributions (last 10)
  const { data: contribs } = await db
    .from("contributions")
    .select("id, amount, type, date, members(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  (contribs || []).forEach((c) => items.push({
    type: "contribution",
    text: `${c.members?.name || "Member"} — ${c.type} of ${Math.round(c.amount).toLocaleString()}`,
    date: c.date,
    icon: "dollar",
  }));

  // Recent loans (last 5)
  const { data: loans } = await db
    .from("loans")
    .select("id, amount, status, requested_at, members(name)")
    .order("requested_at", { ascending: false })
    .limit(5);

  (loans || []).forEach((l) => items.push({
    type: "loan",
    text: `${l.members?.name || "Member"} — loan ${l.status} (${Math.round(l.amount).toLocaleString()})`,
    date: l.requested_at,
    icon: "landmark",
  }));

  // Recent fines (last 5)
  const { data: fines } = await db
    .from("fines")
    .select("id, amount, reason, date, members(name)")
    .order("date", { ascending: false })
    .limit(5);

  (fines || []).forEach((f) => items.push({
    type: "fine",
    text: `${f.members?.name || "Member"} — fined for ${f.reason}`,
    date: f.date,
    icon: "alert",
  }));

  // Sort all by date descending
  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  return NextResponse.json(items.slice(0, 15));
}
