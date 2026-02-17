// app/api/orders/open/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/orders/open
 * Lists open (saved) jobs for the logged-in staff member
 */
export async function GET() {
  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const staff_id = Number(session.staff.id);

  const { data, error } = await supabaseServer
    .from("orders")
    .select("id, status, vehicle_id, staff_id, customer_id, staff_customer_id, customer_is_staff, plate, subtotal, discount_amount, total, note, created_at, updated_at")
    .eq("status", "open")
    .eq("staff_id", staff_id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("GET /api/orders/open error:", error);
    return NextResponse.json({ orders: [] }, { status: 200 });
  }

  return NextResponse.json({ orders: data ?? [] }, { status: 200 });
}

/**
 * DELETE /api/orders/open
 * Body: { order_id: string }
 * Deletes an open job for the logged-in staff member
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const staff_id = Number(session.staff.id);

  const body = await req.json().catch(() => ({}));
  const order_id = typeof body?.order_id === "string" ? body.order_id.trim() : "";
  if (!order_id) return NextResponse.json({ error: "order_id is required" }, { status: 400 });

  // verify ownership + open
  const { data: order, error: oErr } = await supabaseServer
    .from("orders")
    .select("id, status, staff_id")
    .eq("id", order_id)
    .maybeSingle();

  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (String(order.status ?? "").toLowerCase() !== "open") {
    return NextResponse.json({ error: "Only open jobs can be deleted" }, { status: 400 });
  }

  if (Number(order.staff_id) !== staff_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // delete lines first
  const { error: lErr } = await supabaseServer.from("order_lines").delete().eq("order_id", order_id);
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  // delete order
  const { error: dErr } = await supabaseServer.from("orders").delete().eq("id", order_id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 200 });
}
