// app/api/orders/void/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const staff = session.staff;
    if (Number(staff.permissions_level ?? 0) < 800) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    const reason = String(body?.reason ?? "").trim() || "Voided";

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (String(order.status ?? "").toLowerCase() === "void") {
      return NextResponse.json({ error: "Order already voided" }, { status: 400 });
    }

    // 1) mark all lines voided
    const { error: lErr } = await supabase
      .from("order_lines")
      .update({
        is_voided: true,
        voided_at: new Date().toISOString(),
        voided_by_staff_id: staff.id,
        void_reason: `VOID ORDER: ${reason}`,
      })
      .eq("order_id", orderId);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    // 2) mark order void + zero totals
    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({
        status: "void",
        voided_at: new Date().toISOString(),
        voided_by_staff_id: staff.id,
        void_reason: reason,
        subtotal: 0,
        discount_amount: 0,
        total: 0,
      })
      .eq("id", orderId)
      .select("id, status, subtotal, discount_amount, total, voided_at, void_reason")
      .single();

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ success: true, order: updated });
  } catch (e: any) {
    console.error("Void order error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
