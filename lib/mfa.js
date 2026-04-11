import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";

export function generateMFASetup(email) {
  const secret = speakeasy.generateSecret({
    name: `GM06 (${email})`,
    issuer: "GREEN MINDS 06",
    length: 20,
  });
  return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
}

export async function generateQRCode(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyMFACode(secret, code) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code,
    window: 1, // ±30 seconds for clock skew
  });
}

export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

export function hashBackupCode(code) {
  return crypto.createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
}
