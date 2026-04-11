import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getServiceClient } from "./supabase";
import { cookies } from "next/headers";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is not set.");
    }
    // Only allow fallback in development with a warning
    console.warn("WARNING: JWT_SECRET not set — using insecure dev default. Set JWT_SECRET before deploying.");
    return "dev-secret-DO-NOT-USE-IN-PRODUCTION";
  }
  return secret;
}
const COOKIE_NAME = "gm06_session";

export async function authenticate(email, password) {
  const db = getServiceClient();
  const { data: member, error } = await db
    .from("members")
    .select("id, name, email, role, password_hash, phone, mfa_enabled")
    .eq("email", email.toLowerCase().trim())
    .eq("is_active", true)
    .single();

  if (error || !member) return { error: "Invalid email or password" };
  if (!member.password_hash) return { error: "Account not set up. Contact the treasurer." };

  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) return { error: "Invalid email or password" };

  // If MFA is enabled, return a temp token instead of a full session
  if (member.mfa_enabled) {
    const tempToken = jwt.sign(
      { id: member.id, type: "mfa_temp" },
      getSecret(),
      { expiresIn: "5m" }
    );
    return { mfa_required: true, temp_token: tempToken, member: { id: member.id, name: member.name } };
  }

  const token = jwt.sign(
    { id: member.id, name: member.name, email: member.email, role: member.role },
    getSecret(),
    { expiresIn: "7d" }
  );

  return { token, member: { id: member.id, name: member.name, email: member.email, role: member.role } };
}

export function verifyTempToken(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.type !== "mfa_temp") return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(member) {
  return jwt.sign(
    { id: member.id, name: member.name, email: member.email, role: member.role },
    getSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function isAdmin(session) {
  return session?.role === "admin";
}

// Hash a password for storage
export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 10);
}

// Generate a random default password
export function generateDefaultPassword() {
  return crypto.randomBytes(6).toString("base64url"); // 8 chars, URL-safe
}
