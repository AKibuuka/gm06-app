import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { generateMFASetup, generateQRCode, verifyMFACode, generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import bcrypt from "bcryptjs";

// POST /api/mfa — start MFA setup (returns QR code + secret)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data: member } = await db
    .from("members")
    .select("email, mfa_enabled")
    .eq("id", session.id)
    .single();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.mfa_enabled) return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });

  const { secret, otpauthUrl } = generateMFASetup(member.email);
  const qrCode = await generateQRCode(otpauthUrl);

  return NextResponse.json({ secret, qr_code: qrCode });
}

// PUT /api/mfa — verify setup code and enable MFA
export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await request.json();
  if (!secret || !code) return NextResponse.json({ error: "Secret and code are required" }, { status: 400 });

  // Verify the code matches the secret
  if (!verifyMFACode(secret, code)) {
    return NextResponse.json({ error: "Invalid code. Make sure your authenticator app is synced." }, { status: 400 });
  }

  const db = getServiceClient();

  // Save secret and enable MFA
  const { error } = await db.from("members").update({
    mfa_secret: secret,
    mfa_enabled: true,
  }).eq("id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Generate and save backup codes
  const backupCodes = generateBackupCodes(10);

  // Clear any existing recovery codes
  await db.from("mfa_recovery_codes").delete().eq("member_id", session.id);

  // Insert hashed codes
  const codeRows = backupCodes.map((c) => ({
    member_id: session.id,
    code: hashBackupCode(c),
    used: false,
  }));
  await db.from("mfa_recovery_codes").insert(codeRows);

  return NextResponse.json({ ok: true, backup_codes: backupCodes });
}

// DELETE /api/mfa — disable MFA (requires password confirmation)
export async function DELETE(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password } = await request.json();
  if (!password) return NextResponse.json({ error: "Password is required to disable MFA" }, { status: 400 });

  const db = getServiceClient();
  const { data: member } = await db.from("members").select("password_hash").eq("id", session.id).single();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  // Disable MFA and clear secret
  await db.from("members").update({ mfa_enabled: false, mfa_secret: null }).eq("id", session.id);
  await db.from("mfa_recovery_codes").delete().eq("member_id", session.id);

  return NextResponse.json({ ok: true });
}
