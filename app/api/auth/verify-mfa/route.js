import { NextResponse } from "next/server";
import { verifyTempToken, createSessionToken } from "@/lib/auth";
import { verifyMFACode, hashBackupCode } from "@/lib/mfa";
import { getServiceClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const { code } = await request.json();
  const cookieStore = await cookies();
  const temp_token = cookieStore.get("gm06_mfa_temp")?.value;

  if (!temp_token || !code) {
    return NextResponse.json({ error: "Token and code are required" }, { status: 400 });
  }

  // Verify temp token (5-minute expiry)
  const payload = verifyTempToken(temp_token);
  if (!payload) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
  }

  // Rate limit MFA attempts: 5 per 5 minutes per user
  const rl = checkRateLimit(`mfa:${payload.id}`, { max: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please log in again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
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
  // Set full session cookie
  response.cookies.set("gm06_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  // Clear the temp MFA cookie
  response.cookies.delete("gm06_mfa_temp");

  return response;
}
