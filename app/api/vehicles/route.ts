// app/api/vehicles/route.ts
/**
 * VEHICLES API
 * Handles CRUD for vehicles table with session-based auth.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------
// SUPABASE SERVER CLIENT (service role)
// ---------------------------------------------------------
function supabaseServer() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------
// AUTH HELPERS
// ---------------------------------------------------------
async function requireStaff() {
  const session = await getSession();
  const staff = session?.staff || null;

  if (!staff?.id) {
    return { staff: null, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  return { staff, error: null };
}

function canManageVehicles(role: string | undefined | null) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "owner" || r === "manager";
}

// ---------------------------------------------------------
// GET: list vehicles (all logged-in staff can read)
// ---------------------------------------------------------
export async function GET() {
  const { staff, error } = await requireStaff();
  if (error) return error;

  const supabase = supabaseServer();

  const { data, error: dbError } = await supabase
    .from("vehicles")
    .select(
      `
      id,
      manufacturer,
      model,
      base_price,
      category,
      stock_class,
      maxed_class,
      note,
      active,
      created_at
    `
    )
    .order("id", { ascending: true });

  if (dbError) {
    console.error("GET /api/vehicles error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ vehicles: data ?? [] });
}

// ---------------------------------------------------------
// POST: create vehicle (admin/owner/manager)
// ---------------------------------------------------------
export async function POST(req: Request) {
  const { staff, error } = await requireStaff();
  if (error) return error;

  if (!canManageVehicles(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const payload = {
    manufacturer: String(body.manufacturer ?? "").trim(),
    model: String(body.model ?? "").trim(),
    base_price: Number(body.base_price ?? 0),
    category: body.category ?? null,
    stock_class: body.stock_class ?? null,
    maxed_class: body.maxed_class ?? null,
    note: body.note ?? null,
    active: Boolean(body.active),
  };

  if (!payload.manufacturer) {
    return NextResponse.json({ error: "Manufacturer is required" }, { status: 400 });
  }
  if (!payload.model) {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }
  if (!Number.isFinite(payload.base_price)) {
    return NextResponse.json({ error: "Invalid base price" }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { data, error: dbError } = await supabase
    .from("vehicles")
    .insert(payload)
    .select(
      `
      id,
      manufacturer,
      model,
      base_price,
      category,
      stock_class,
      maxed_class,
      note,
      active,
      created_at
    `
    )
    .single();

  if (dbError) {
    console.error("POST /api/vehicles error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ vehicle: data });
}

// ---------------------------------------------------------
// PUT: update vehicle (admin/owner/manager)
// ---------------------------------------------------------
export async function PUT(req: Request) {
  const { staff, error } = await requireStaff();
  if (error) return error;

  if (!canManageVehicles(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing/invalid vehicle id" }, { status: 400 });
  }

  const updates: any = {};

  if (body.manufacturer !== undefined) updates.manufacturer = String(body.manufacturer).trim();
  if (body.model !== undefined) updates.model = String(body.model).trim();
  if (body.base_price !== undefined) updates.base_price = Number(body.base_price);
  if (body.category !== undefined) updates.category = body.category ?? null;
  if (body.stock_class !== undefined) updates.stock_class = body.stock_class ?? null;
  if (body.maxed_class !== undefined) updates.maxed_class = body.maxed_class ?? null;
  if (body.note !== undefined) updates.note = body.note ?? null;
  if (body.active !== undefined) updates.active = Boolean(body.active);

  if (updates.base_price !== undefined && !Number.isFinite(updates.base_price)) {
    return NextResponse.json({ error: "Invalid base price" }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { data, error: dbError } = await supabase
    .from("vehicles")
    .update(updates)
    .eq("id", id)
    .select(
      `
      id,
      manufacturer,
      model,
      base_price,
      category,
      stock_class,
      maxed_class,
      note,
      active,
      created_at
    `
    )
    .single();

  if (dbError) {
    console.error("PUT /api/vehicles error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ vehicle: data });
}

// ---------------------------------------------------------
// DELETE: delete vehicle (admin/owner/manager)
// ---------------------------------------------------------
export async function DELETE(req: Request) {
  const { staff, error } = await requireStaff();
  if (error) return error;

  if (!canManageVehicles(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing/invalid vehicle id" }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { error: dbError } = await supabase.from("vehicles").delete().eq("id", id);

  if (dbError) {
    console.error("DELETE /api/vehicles error:", dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
