import { NextResponse } from "next/server";
export const maxDuration = 30;
import { updatePrices } from "@/lib/prices";

// Vercel Cron Job — runs daily at 6:00 PM UTC (9 PM EAT)
// Also callable manually with the CRON_SECRET header
export async function GET(request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await updatePrices();

  return NextResponse.json({
    ok: true,
    updated: result.updated,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
