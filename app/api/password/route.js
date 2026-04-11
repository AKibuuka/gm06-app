import { NextResponse } from "next/server";
export const maxDuration = 15;
import bcrypt from "bcryptjs";
import { getSession, isAdmin, hashPassword } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// PUT /api/password — change password
// Body: { current_password, new_password } for self
// Body: { member_id, new_password } for admin resetting another member
export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { current_password, new_password, member_id } = await request.json();
  const db = getServiceClient();

  if (!new_password || new_password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Admin resetting another member's password
  if (member_id && isAdmin(session) && member_id !== session.id) {
    const hash = await hashPassword(new_password);
    const { error } = await db.from("members").update({ password_hash: hash }).eq("id", member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Password reset successfully" });
  }

  // Member changing their own password — verify current password first
  if (!current_password) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 });
  }

  const { data: member } = await db.from("members").select("password_hash").eq("id", session.id).single();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const valid = await bcrypt.compare(current_password, member.password_hash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

  const hash = await hashPassword(new_password);
  const { error } = await db.from("members").update({ password_hash: hash }).eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, message: "Password changed successfully" });
}
