// app/api/orders/void-line/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

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
    const lineId = body?.line_id;
    const reason = String(body?.reason ?? "").trim() || "Voided item";

    if (!orderId || !lineId) {
      return NextResponse.json({ error: "order_id and line_id are required" }, { status: 400 });
    }

    // Load order (need discount_id + status)
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, status, discount_id")
      .eq("id", orderId)
      .maybeSingle();

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (String(order.status ?? "").toLowerCase() === "void") {
      return NextResponse.json(
        { error: "Order is void; cannot void individual lines" },
        { status: 400 }
      );
    }

    // Verify line belongs to order
    const { data: line, error: lReadErr } = await supabase
      .from("order_lines")
      .select("id, order_id, is_voided")
      .eq("id", lineId)
      .maybeSingle();

    if (lReadErr) return NextResponse.json({ error: lReadErr.message }, { status: 500 });

    if (!line || String(line.order_id) !== String(orderId)) {
      return NextResponse.json({ error: "Line not found for this order" }, { status: 404 });
    }

    if (line.is_voided) {
      return NextResponse.json({ error: "Line already voided" }, { status: 400 });
    }

    // Mark the line voided
    const { error: lErr } = await supabase
      .from("order_lines")
      .update({
        is_voided: true,
        voided_at: new Date().toISOString(),
        voided_by_staff_id: staff.id,
        void_reason: reason,
      })
      .eq("id", lineId)
      .eq("order_id", orderId);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    // Recalculate totals from non-voided lines using unit_price
    const { data: lines, error: linesErr } = await supabase
      .from("order_lines")
      .select("quantity, unit_price, is_voided")
      .eq("order_id", orderId);

    if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 });

    const activeLines = (Array.isArray(lines) ? lines : []).filter((x: any) => !x.is_voided);

    // If all lines are voided, void the whole order
    if (activeLines.length === 0) {
      const { data: updatedVoid, error: vErr } = await supabase
        .from("orders")
        .update({
          status: "void",
          voided_at: new Date().toISOString(),
          voided_by_staff_id: staff.id,
          void_reason: "All lines voided",
          subtotal: 0,
          discount_amount: 0,
          total: 0,
        })
        .eq("id", orderId)
        .select("id, status, subtotal, discount_amount, total")
        .single();

      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
      return NextResponse.json({ success: true, order: updatedVoid, order_voided: true });
    }

    const subtotal = roundToCents(
      activeLines.reduce((sum: number, x: any) => {
        const qty = Number(x.quantity ?? 0);
        const unit = Number(x.unit_price ?? 0);
        return sum + qty * unit;
      }, 0)
    );

    // Load discount percent (if any)
    let discountPercent = 0;
    if (order.discount_id) {
      const { data: disc, error: dErr } = await supabase
        .from("discounts")
        .select("percent")
        .eq("id", order.discount_id)
        .maybeSingle();

      if (!dErr && disc) discountPercent = Number(disc.percent ?? 0);
    }

    const discountAmount = roundToCents((subtotal * discountPercent) / 100);
    const rawTotal = roundToCents(subtotal - discountAmount);
    const total = Math.ceil(rawTotal);

    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({ subtotal, discount_amount: discountAmount, total })
      .eq("id", orderId)
      .select("id, subtotal, discount_amount, total")
      .single();

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ success: true, order: updated });
  } catch (e: any) {
    console.error("Void line error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
