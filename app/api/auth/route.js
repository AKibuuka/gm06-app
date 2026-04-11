import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Rate limit by email: 10 attempts per 15 minutes
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rl = checkRateLimit(`login:${email.toLowerCase().trim()}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const result = await authenticate(email, password);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // MFA required — set temp token as httpOnly cookie, don't expose in response body
  if (result.mfa_required) {
    const response = NextResponse.json({
      mfa_required: true,
      member: result.member,
    });
    response.cookies.set("gm06_mfa_temp", result.temp_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 300, // 5 minutes
      path: "/",
    });
    return response;
  }

  // No MFA — set session cookie directly
  const response = NextResponse.json({ member: result.member });
  response.cookies.set("gm06_session", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("gm06_session");
  return response;
}
