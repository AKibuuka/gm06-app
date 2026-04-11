import { NextResponse } from "next/server";
import { verifyTempToken, createSessionToken } from "@/lib/auth";
import { verifyMFACode, hashBackupCode } from "@/lib/mfa";
import { getServiceClient } from "@/lib/supabase";

export async function POST(request) {
  const { temp_token, code } = await request.json();

  if (!temp_token || !code) {
    return NextResponse.json({ error: "Token and code are required" }, { status: 400 });
  }

  // Verify temp token (5-minute expiry)
  const payload = verifyTempToken(temp_token);
  if (!payload) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  const db = getServiceClient();
  const { data: member } = await db
    .from("members")
    .select("id, name, email, role, mfa_secret")
    .eq("id", payload.id)
    .eq("is_active", true)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const trimmedCode = code.trim();

  // Try TOTP code first (6 digits)
  if (/^\d{6}$/.test(trimmedCode)) {
    if (!verifyMFACode(member.mfa_secret, trimmedCode)) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 401 });
    }
  } else {
    // Try backup code (8 hex chars)
    const hashedCode = hashBackupCode(trimmedCode);
    const { data: recovery } = await db
      .from("mfa_recovery_codes")
      .select("id")
      .eq("member_id", member.id)
      .eq("code", hashedCode)
      .eq("used", false)
      .maybeSingle();

    if (!recovery) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 401 });
    }

    // Mark backup code as used
    await db.from("mfa_recovery_codes").update({ used: true }).eq("id", recovery.id);
  }

  // Create full session token
  const token = createSessionToken(member);

  const response = NextResponse.json({
    member: { id: member.id, name: member.name, email: member.email, role: member.role },
  });
  response.cookies.set("gm06_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
