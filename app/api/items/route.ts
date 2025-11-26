// app/api/items/route.ts

/**
 * ITEMS API — strong typing + safe string handling
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

const PRIVILEGED_ROLES = ["owner", "admin", "manager"];

/**
 * Ensures caller has staff + permitted role
 */
async function requirePrivilegedRole() {
  const session = await getSession();

  if (!session?.staff) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const role = session.staff.role?.toLowerCase() ?? "staff";

  if (!PRIVILEGED_ROLES.includes(role)) {
    return { ok: false, status: 403, message: "Insufficient permissions" };
  }

  return { ok: true, role };
}

/* -------------------------------------------------------------
   GET — Public items (NO COST PRICE)
------------------------------------------------------------- */
export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("items")
    .select("id, name, price, stock, category, barcode")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

/* -------------------------------------------------------------
   POST — Create item (privileged only)
------------------------------------------------------------- */
export async function POST(req: Request) {
  const guard = await requirePrivilegedRole();
  if (!guard.ok)
    return NextResponse.json({ error: guard.message }, { status: guard.status });

  const supabase = supabaseServer();
  const body = await req.json();

  const barcode =
    typeof body.barcode === "string"
      ? body.barcode.trim() || null
      : null;

  const newItem = {
    name: String(body.name ?? ""),
    price: Number(body.price ?? 0),
    stock: Number(body.stock ?? 0),
    category: String(body.category ?? ""),
    barcode,
    cost_price:
      body.cost_price !== undefined && body.cost_price !== null
        ? Number(body.cost_price)
        : null,
  };

  const { data, error } = await supabase
    .from("items")
    .insert([newItem])
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

/* -------------------------------------------------------------
   PUT — Update item (privileged only)
------------------------------------------------------------- */
export async function PUT(req: Request) {
  const guard = await requirePrivilegedRole();
  if (!guard.ok)
    return NextResponse.json({ error: guard.message }, { status: guard.status });

  const supabase = supabaseServer();
  const body = await req.json();

  if (!body.id)
    return NextResponse.json({ error: "Missing item ID" }, { status: 400 });

  const updates: Record<string, any> = {};

  if (body.name !== undefined) updates.name = String(body.name);
  if (body.price !== undefined) updates.price = Number(body.price);
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.category !== undefined) updates.category = String(body.category);

  if (body.barcode !== undefined) {
    updates.barcode =
      typeof body.barcode === "string"
        ? body.barcode.trim() || null
        : null;
  }

  // ✅ FINAL FIX — avoid "string | undefined" error
  if (PRIVILEGED_ROLES.includes(String(guard.role))) {
    updates.cost_price =
      body.cost_price !== undefined && body.cost_price !== null
        ? Number(body.cost_price)
        : null;
  }

  const { data, error } = await supabase
    .from("items")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

/* -------------------------------------------------------------
   DELETE — Remove item
------------------------------------------------------------- */
export async function DELETE(req: Request) {
  const guard = await requirePrivilegedRole();
  if (!guard.ok)
    return NextResponse.json(
      { error: guard.message },
      { status: guard.status }
    );

  const supabase = supabaseServer();
  const { id } = await req.json();

  if (!id)
    return NextResponse.json({ error: "Missing item ID" }, { status: 400 });

  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
