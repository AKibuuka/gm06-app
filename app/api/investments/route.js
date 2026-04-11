import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceClient();
  const { data } = await db.from("investments").select("*").order("asset_class").order("name");
  return NextResponse.json(data || []);
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await request.json();
  const db = getServiceClient();
  const { data, error } = await db.from("investments").insert({
    name: body.name,
    ticker: body.ticker || null,
    asset_class: body.asset_class,
    quantity: parseFloat(body.quantity) || 0,
    cost_basis: parseFloat(body.cost_basis) || 0,
    current_price: parseFloat(body.current_price) || 0,
    current_value: parseFloat(body.current_value) || 0,
    price_source: body.price_source || "manual",
    notes: body.notes || null,
    is_active: body.is_active !== false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Recalculate value if price or quantity changed
  if (updates.current_price !== undefined && updates.quantity !== undefined) {
    updates.current_value = parseFloat(updates.current_price) * parseFloat(updates.quantity);
  } else if (updates.current_price !== undefined) {
    const db2 = getServiceClient();
    const { data: existing } = await db2.from("investments").select("quantity").eq("id", id).single();
    if (existing) updates.current_value = parseFloat(updates.current_price) * existing.quantity;
  }

  updates.updated_at = new Date().toISOString();

  const db = getServiceClient();
  const { data, error } = await db.from("investments").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await request.json();
  const db = getServiceClient();
  // Soft delete
  const { error } = await db.from("investments").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
