import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// GET /api/search?q=keyword
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return NextResponse.json({ members: [], contributions: [], loans: [] });

  const db = getServiceClient();
  const admin = isAdmin(session);
  const pattern = `%${q}%`;

  // Search members (admin sees all, member sees only self)
  let memberQuery = db.from("members").select("id, name, email, role").eq("is_active", true).ilike("name", pattern).limit(5);
  if (!admin) memberQuery = memberQuery.eq("id", session.id);
  const { data: members } = await memberQuery;

  // Search contributions
  let contribQuery = db.from("contributions").select("id, amount, type, description, date, bank_ref, members(name)").or(`description.ilike.${pattern},bank_ref.ilike.${pattern}`).order("date", { ascending: false }).limit(5);
  if (!admin) contribQuery = contribQuery.eq("member_id", session.id);
  const { data: contributions } = await contribQuery;

  // Search loans (by reason)
  let loanQuery = db.from("loans").select("id, amount, status, reason, members(name)").ilike("reason", pattern).order("requested_at", { ascending: false }).limit(5);
  if (!admin) loanQuery = loanQuery.eq("member_id", session.id);
  const { data: loans } = await loanQuery;

  return NextResponse.json({
    members: members || [],
    contributions: contributions || [],
    loans: loans || [],
  });
}
