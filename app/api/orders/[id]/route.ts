// app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

async function requireSession(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  return session?.staff ? session : null;
}

/**
 * GET /api/orders/:id
 * Returns order + lines
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isManagerOrAbove(session.staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const orderId = typeof id === "string" ? id.trim() : "";
    if (!orderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data: order, error: orderErr } = await supabaseServer
      .from("orders")
      .select(
        "id, status, vehicle_id, staff_id, customer_id, discount_id, customer_is_staff, plate, vehicle_base_price, subtotal, discount_amount, total, note, created_at, updated_at"
      )
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: lines, error: linesErr } = await supabaseServer
      .from("order_lines")
      .select(
        "id, order_id, vehicle_id, mod_id, mod_name, quantity, unit_price, pricing_type, pricing_value, created_at, is_voided, void_reason, voided_at"
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (linesErr) {
      console.error("GET /api/orders/[id] lines error:", linesErr);
      return NextResponse.json({ order, lines: [] }, { status: 200 });
    }

    return NextResponse.json({ order, lines: lines ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/orders/[id] fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/orders/:id
 * Body: { status: "paid" | "void" | "open" }
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isManagerOrAbove(session.staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const orderId = typeof id === "string" ? id.trim() : "";
    if (!orderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const status = typeof body?.status === "string" ? body.status.toLowerCase().trim() : "";

    if (status !== "open" && status !== "paid" && status !== "void") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .select(
        "id, status, vehicle_id, staff_id, customer_id, discount_id, customer_is_staff, plate, vehicle_base_price, subtotal, discount_amount, total, note, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      console.error("PATCH /api/orders/[id] error:", error);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    return NextResponse.json({ order: data }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/orders/[id] fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
