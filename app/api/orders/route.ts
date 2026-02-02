// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type PricingType = "percentage" | "flat";

type IncomingLine = {
  vehicle_id: number;
  mod_id: string;
  mod_name: string;
  quantity: number;
  computed_price: number; // unit price
  pricing_type: PricingType;
  pricing_value: number;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toUuid(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
 * GET /api/orders?status=paid|void|all
 * Lists recent orders (Jobs history) — manager+ only
 */
export async function GET(req: Request) {
  const session = await requireSession(req);
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isManagerOrAbove(session.staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "paid").toLowerCase();

    let query = supabaseServer
      .from("orders")
      .select(
        "id, status, vehicle_id, staff_id, customer_id, discount_id, subtotal, discount_amount, total, note, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status !== "all") {
      if (status !== "paid" && status !== "void") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/orders error:", error);
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    return NextResponse.json({ orders: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/orders fatal:", err);
    return NextResponse.json({ orders: [] }, { status: 200 });
  }
}

/**
 * POST /api/orders
 * Card-only POS flow: creates a new PAID order immediately
 */
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const staff_id = toNumber(body?.staff_id);
    const vehicle_id = toNumber(body?.vehicle_id);

    const customer_id =
      body?.customer_id === null || body?.customer_id === undefined
        ? null
        : toNumber(body.customer_id);

    const discount_id =
      body?.discount_id === null || body?.discount_id === undefined
        ? null
        : toNumber(body.discount_id);

    const vehicle_base_price = toNumber(body?.vehicle_base_price);
    const subtotal = toNumber(body?.subtotal);
    const discount_amount = toNumber(body?.discount_amount);
    const total = toNumber(body?.total);

    const note =
      typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const lines: IncomingLine[] = Array.isArray(body?.lines) ? body.lines : [];

    // Staff must match session
    if (!staff_id || staff_id !== session.staff.id) {
      return NextResponse.json({ error: "Invalid staff_id" }, { status: 400 });
    }

    if (!vehicle_id) {
      return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines is required" }, { status: 400 });
    }

    // Validate lines
    for (const l of lines) {
      if (toNumber(l.vehicle_id) !== vehicle_id) {
        return NextResponse.json(
          { error: "All lines must match vehicle_id" },
          { status: 400 }
        );
      }

      const qty = toNumber(l.quantity);
      if (!qty || qty < 1) {
        return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });
      }

      const unit = toNumber(l.computed_price);
      if (unit < 0) {
        return NextResponse.json(
          { error: "computed_price must be >= 0" },
          { status: 400 }
        );
      }

      const pt = l.pricing_type;
      if (pt !== "percentage" && pt !== "flat") {
        return NextResponse.json({ error: "Invalid pricing_type" }, { status: 400 });
      }

      const pv = toNumber(l.pricing_value);
      if (pv < 0) {
        return NextResponse.json(
          { error: "pricing_value must be >= 0" },
          { status: 400 }
        );
      }
      if (pt === "percentage" && pv > 100) {
        return NextResponse.json(
          { error: "percentage pricing_value must be <= 100" },
          { status: 400 }
        );
      }

      const modId = toUuid(l.mod_id);
      const modName = typeof l.mod_name === "string" ? l.mod_name.trim() : "";

      if (!modId) {
        return NextResponse.json({ error: "mod_id is required" }, { status: 400 });
      }
      if (!modName) {
        return NextResponse.json({ error: "mod_name is required" }, { status: 400 });
      }
    }

    // Create order (PAID)
    const { data: order, error: orderErr } = await supabaseServer
      .from("orders")
      .insert({
        status: "paid",
        vehicle_id,
        staff_id,
        customer_id,
        discount_id,
        vehicle_base_price,
        subtotal,
        discount_amount,
        total,
        note,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("POST /api/orders order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const order_id = order.id as string;

    // Insert order lines
    const lineRows = lines.map((l) => ({
      order_id,
      vehicle_id,
      mod_id: toUuid(l.mod_id),
      mod_name: String(l.mod_name ?? "").trim(),
      quantity: toNumber(l.quantity, 1),
      unit_price: toNumber(l.computed_price),
      pricing_type: l.pricing_type,
      pricing_value: toNumber(l.pricing_value),
    }));

    const { error: linesErr } = await supabaseServer.from("order_lines").insert(lineRows);

    if (linesErr) {
      console.error("POST /api/orders lines insert error:", linesErr);

      // Best-effort cleanup
      await supabaseServer.from("orders").delete().eq("id", order_id);

      return NextResponse.json({ error: "Failed to create order lines" }, { status: 500 });
    }

    return NextResponse.json({ order_id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/orders fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
