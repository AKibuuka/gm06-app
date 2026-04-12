import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

// GET /api/ballots — list all ballots with vote counts
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();

  const { data: ballots, error } = await db
    .from("ballots")
    .select("*, creator:members!created_by(name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get all votes and member's own votes
  const ballotIds = (ballots || []).map((b) => b.id);
  let allVotes = [];
  let myVotes = [];
  if (ballotIds.length > 0) {
    const { data: votes } = await db.from("ballot_votes").select("ballot_id, choice, member_id").in("ballot_id", ballotIds);
    allVotes = votes || [];
    myVotes = allVotes.filter((v) => v.member_id === session.id);
  }

  // Get active member count for participation %
  const { count: memberCount } = await db.from("members").select("id", { count: "exact", head: true }).eq("is_active", true);

  const enriched = (ballots || []).map((b) => {
    const ballotVotes = allVotes.filter((v) => v.ballot_id === b.id);
    const votedMembers = new Set(ballotVotes.map((v) => v.member_id));
    const results = {};
    for (const opt of (b.options || [])) {
      results[opt] = ballotVotes.filter((v) => v.choice === opt).length;
    }
    return {
      ...b,
      results,
      total_voters: votedMembers.size,
      member_count: memberCount || 0,
      my_votes: myVotes.filter((v) => v.ballot_id === b.id).map((v) => v.choice),
    };
  });

  return NextResponse.json(enriched);
}

// POST /api/ballots — admin creates a ballot
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { title, description, options, allow_multiple } = await request.json();
  if (!title || !options || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "Title and at least 2 options are required" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db.from("ballots").insert({
    title,
    description: description || null,
    options,
    allow_multiple: allow_multiple || false,
    created_by: session.id,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "create", "ballot", data.id, { title, options });
  return NextResponse.json(data);
}

// PUT /api/ballots — vote on a ballot OR admin closes a ballot
export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, choice } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getServiceClient();
  const { data: ballot } = await db.from("ballots").select("*").eq("id", id).single();
  if (!ballot) return NextResponse.json({ error: "Ballot not found" }, { status: 404 });

  // ── Vote ──
  if (action === "vote") {
    if (ballot.status !== "open") {
      return NextResponse.json({ error: "This ballot is closed" }, { status: 400 });
    }
    if (!choice || !ballot.options.includes(choice)) {
      return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }

    // Check if already voted (for single-choice ballots)
    if (!ballot.allow_multiple) {
      const { data: existing } = await db.from("ballot_votes")
        .select("id").eq("ballot_id", id).eq("member_id", session.id).limit(1);
      if (existing?.length > 0) {
        // Update existing vote
        await db.from("ballot_votes").delete().eq("ballot_id", id).eq("member_id", session.id);
      }
    }

    const { error } = await db.from("ballot_votes").insert({
      ballot_id: id,
      member_id: session.id,
      choice,
    });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "You already voted for this option" }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Vote recorded" });
  }

  // ── Close ballot (admin only) ──
  if (action === "close") {
    if (!isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    if (ballot.status !== "open") return NextResponse.json({ error: "Ballot is already closed" }, { status: 400 });

    // Tally results
    const { data: votes } = await db.from("ballot_votes").select("choice").eq("ballot_id", id);
    const tally = {};
    for (const opt of ballot.options) tally[opt] = 0;
    for (const v of (votes || [])) tally[v.choice] = (tally[v.choice] || 0) + 1;

    // Determine winner(s)
    const maxVotes = Math.max(...Object.values(tally), 0);
    const winners = Object.entries(tally).filter(([, count]) => count === maxVotes && count > 0).map(([opt]) => opt);
    const outcome = winners.length === 1
      ? winners[0]
      : winners.length > 1
        ? `Tie: ${winners.join(", ")}`
        : "No votes cast";

    // Close ballot
    await db.from("ballots").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);

    // Create decision record
    const { data: decision } = await db.from("decisions").insert({
      ballot_id: id,
      title: ballot.title,
      outcome,
      details: { tally, total_votes: (votes || []).length, options: ballot.options },
    }).select("*").single();

    await logAudit(session.id, "close", "ballot", id, { title: ballot.title, outcome, tally });
    return NextResponse.json({ ballot: { ...ballot, status: "closed" }, decision, message: `Ballot closed. Outcome: ${outcome}` });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE /api/ballots — admin deletes an open ballot
export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await request.json();
  const db = getServiceClient();
  const { error } = await db.from("ballots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(session.id, "delete", "ballot", id, {});
  return NextResponse.json({ ok: true });
}
