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
  // Sanitize pattern for PostgREST filters — escape special chars
  const sanitized = q.replace(/[%_\\,().]/g, "");
  if (!sanitized) return NextResponse.json({ members: [], contributions: [], loans: [] });
  const pattern = `%${sanitized}%`;

  // Search members (admin sees all, member sees only self)
  let memberQuery = db.from("members").select("id, name, email, role").eq("is_active", true).ilike("name", pattern).limit(5);
  if (!admin) memberQuery = memberQuery.eq("id", session.id);
  const { data: members } = await memberQuery;

  // Search contributions — use separate .ilike() filters instead of .or() with interpolation
  let contribQuery = db.from("contributions").select("id, amount, type, description, date, bank_ref, members(name)").order("date", { ascending: false }).limit(5);
  if (!admin) contribQuery = contribQuery.eq("member_id", session.id);
  // Fetch both description and bank_ref matches separately, then merge
  let refQuery = db.from("contributions").select("id, amount, type, description, date, bank_ref, members(name)").ilike("bank_ref", pattern).order("date", { ascending: false }).limit(5);
  if (!admin) refQuery = refQuery.eq("member_id", session.id);
  const [{ data: byDesc }, { data: byRef }] = await Promise.all([
    contribQuery.ilike("description", pattern),
    refQuery,
  ]);
  // Merge and deduplicate
  const contribMap = new Map();
  for (const c of [...(byDesc || []), ...(byRef || [])]) contribMap.set(c.id, c);
  const contributions = [...contribMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

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
