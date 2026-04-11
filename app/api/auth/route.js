import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const result = await authenticate(email, password);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // MFA required — return temp token, don't set session cookie yet
  if (result.mfa_required) {
    return NextResponse.json({
      mfa_required: true,
      temp_token: result.temp_token,
      member: result.member,
    });
  }

  // No MFA — set session cookie directly
  const response = NextResponse.json({ member: result.member });
  response.cookies.set("gm06_session", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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
