import { NextResponse } from "next/server";
export const maxDuration = 15;
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

// Magic number signatures for server-side file type validation
const SIGNATURES = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF....WEBP)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function detectFileType(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 12));
  for (const [mime, sigs] of Object.entries(SIGNATURES)) {
    for (const sig of sigs) {
      if (sig.every((b, i) => bytes[i] === b)) {
        // Extra check for WebP: bytes 8-11 must be "WEBP"
        if (mime === "image/webp") {
          if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return mime;
          continue;
        }
        return mime;
      }
    }
  }
  return null;
}

// POST /api/upload — upload a receipt image to Supabase Storage
export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Server-side file type validation using magic numbers (not just browser MIME)
  const detectedType = detectFileType(buffer);
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!detectedType || !allowed.includes(detectedType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, and PDF files are allowed" }, { status: 400 });
  }

  const extMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  const ext = extMap[detectedType] || "bin";
  const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const path = `receipts/${fileName}`;

  const db = getServiceClient();

  const { error } = await db.storage.from("receipts").upload(path, buffer, {
    contentType: detectedType,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = db.storage.from("receipts").getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
