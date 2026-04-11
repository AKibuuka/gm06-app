import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updatePrices } from "@/lib/prices";

// POST /api/prices — triggers price update (admin only)
export async function POST() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const updated = await updatePrices();
  return NextResponse.json({ updated, timestamp: new Date().toISOString() });
}
