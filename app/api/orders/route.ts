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
  computed_price: number; // unit price (sale price)
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

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizePlate(v: unknown) {
  if (typeof v !== "string") return null;
  const p = v.trim();
  if (!p) return null;

  const cleaned = p.replace(/\s+/g, " ").toUpperCase();
  if (cleaned.length > 20) return cleaned.slice(0, 20);

  return cleaned;
}

async function requireSession(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  return session?.staff ? session : null;
}

function isDateString(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x);
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

// Blacklist multiplier
async function getBlacklistMultiplier(customer_id: number | null): Promise<number> {
  if (!customer_id) return 1;

  const { data, error } = await supabaseServer
    .from("customers")
    .select("is_blacklisted, blacklist_start, blacklist_end")
    .eq("id", customer_id)
    .maybeSingle();

  if (error) {
    console.error("Blacklist lookup error:", error);
    return 1; // fail-open
  }

  if (!data?.is_blacklisted) return 1;

  const start = data.blacklist_start as unknown;
  const end = data.blacklist_end as unknown;

  if (!isDateString(start) || !isDateString(end)) return 2;

  const t = todayYMD();
  return start <= t && t <= end ? 2 : 1;
}

// Membership discount percent (10 if active)
async function getMembershipDiscountPercent(customer_id: number | null): Promise<number> {
  if (!customer_id) return 0;

  const { data, error } = await supabaseServer
    .from("customers")
    .select("membership_active, membership_start, membership_end")
    .eq("id", customer_id)
    .maybeSingle();

  if (error) {
    console.error("Membership lookup error:", error);
    return 0; // fail-open (no membership)
  }

  if (!data?.membership_active) return 0;

  const start = data.membership_start as unknown;
  const end = data.membership_end as unknown;

  // Open-ended if missing dates
  if (!isDateString(start) || !isDateString(end)) return 10;

  const t = todayYMD();
  return start <= t && t <= end ? 10 : 0;
}

function isRaffleTicketLine(modName: unknown) {
  const s = typeof modName === "string" ? modName.trim().toLowerCase() : "";
  return s === "raffle ticket";
}

async function resolveCustomerNameSnapshot(args: {
  customer_is_staff: boolean;
  customer_id: number | null;
  staff_customer_id: number | null;
}): Promise<{ customer_id: number | null; customer_name: string }> {
  if (args.customer_is_staff) {
    if (args.staff_customer_id && args.staff_customer_id > 0) {
      const { data } = await supabaseServer
        .from("staff")
        .select("id, name")
        .eq("id", args.staff_customer_id)
        .maybeSingle();

      const nm = String(data?.name ?? "").trim();
      if (nm) return { customer_id: null, customer_name: nm };
      return { customer_id: null, customer_name: `Staff #${args.staff_customer_id}` };
    }
    return { customer_id: null, customer_name: "Staff" };
  }

  if (args.customer_id && args.customer_id > 0) {
    const { data } = await supabaseServer
      .from("customers")
      .select("id, name")
      .eq("id", args.customer_id)
      .maybeSingle();

    const nm = String(data?.name ?? "").trim();
    if (nm) return { customer_id: args.customer_id, customer_name: nm };
    return { customer_id: args.customer_id, customer_name: `Customer #${args.customer_id}` };
  }

  return { customer_id: null, customer_name: "Unknown" };
}

async function writeRaffleSalesLog(args: {
  order_id: string;
  staff_id: number;
  sold_at: string | null;
  customer_is_staff: boolean;
  customer_id: number | null;
  staff_customer_id: number | null;
  raffleTickets: number;
}) {
  if (!args.order_id || args.raffleTickets <= 0) return;

  const snap = await resolveCustomerNameSnapshot({
    customer_is_staff: args.customer_is_staff,
    customer_id: args.customer_id,
    staff_customer_id: args.staff_customer_id,
  });

  // Find one raffle line id for traceability (optional)
  const { data: raffleLine } = await supabaseServer
    .from("order_lines")
    .select("id")
    .eq("order_id", args.order_id)
    .ilike("mod_name", "Raffle Ticket")
    .eq("is_voided", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const order_line_id = typeof raffleLine?.id === "string" ? raffleLine.id : null;

  const sold_at = args.sold_at && typeof args.sold_at === "string" ? args.sold_at : new Date().toISOString();

  const { error } = await supabaseServer.from("raffle_sales_log").insert({
    customer_id: snap.customer_id,
    customer_name: snap.customer_name,
    tickets: args.raffleTickets,
    sold_at,
    order_id: args.order_id,
    order_line_id,
    staff_id: args.staff_id,
  });

  if (error) {
    // Best-effort only: do not break checkout
    console.error("writeRaffleSalesLog insert error:", error);
  }
}

/**
 * GET /api/orders?status=paid|voided|all
 * Lists recent orders — manager+ only
 */
export async function GET(req: Request) {
  const session = await requireSession(req);
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = String(session.staff.role ?? "").toLowerCase().trim();
  const isManagerOrAbove = role === "owner" || role === "admin" || role === "manager";
  if (!isManagerOrAbove) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "paid").toLowerCase();

    let query = supabaseServer
      .from("orders")
      .select(
        "id, status, vehicle_id, staff_id, customer_id, staff_customer_id, discount_id, customer_is_staff, plate, subtotal, discount_amount, total, note, created_at, updated_at, voided_at, void_reason, voided_by_staff_id"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status !== "all") {
      if (status !== "paid" && status !== "voided") {
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
 *
 * ✅ Raffle rule:
 * - Raffle tickets are always full price: NO staff 25%, NO discount_id, NO membership %, NO voucher.
 * - But the sale MUST still complete (including staff-as-customer orders).
 * - Raffle log is appended after successful checkout.
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
      body?.customer_id === null || body?.customer_id === undefined ? null : toNumber(body.customer_id);

    const discount_id =
      body?.discount_id === null || body?.discount_id === undefined ? null : toNumber(body.discount_id);

    const customer_is_staff = Boolean(body?.customer_is_staff);

    const staff_customer_id =
      body?.staff_customer_id === null || body?.staff_customer_id === undefined ? null : toNumber(body.staff_customer_id);

    const vehicle_base_price = toNumber(body?.vehicle_base_price);
    const plate = normalizePlate(body?.plate);

    const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const voucher_used_raw = toNumber(body?.voucher_used, 0);
    const voucher_used = voucher_used_raw > 0 ? roundToCents(voucher_used_raw) : 0;

    const lines: IncomingLine[] = Array.isArray(body?.lines) ? body.lines : [];

    if (!staff_id || staff_id !== session.staff.id) {
      return NextResponse.json({ error: "Invalid staff_id" }, { status: 400 });
    }

    if (!vehicle_id) {
      return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines is required" }, { status: 400 });
    }

    for (const l of lines) {
      if (toNumber(l.vehicle_id) !== vehicle_id) {
        return NextResponse.json({ error: "All lines must match vehicle_id" }, { status: 400 });
      }

      const qty = toNumber(l.quantity);
      if (!qty || qty < 1) {
        return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });
      }

      const unit = toNumber(l.computed_price);
      if (unit < 0) {
        return NextResponse.json({ error: "computed_price must be >= 0" }, { status: 400 });
      }

      const pt = l.pricing_type;
      if (pt !== "percentage" && pt !== "flat") {
        return NextResponse.json({ error: "Invalid pricing_type" }, { status: 400 });
      }

      const pv = toNumber(l.pricing_value);
      if (pv < 0) {
        return NextResponse.json({ error: "pricing_value must be >= 0" }, { status: 400 });
      }
      if (pt === "percentage" && pv > 100) {
        return NextResponse.json({ error: "percentage pricing_value must be <= 100" }, { status: 400 });
      }

      const modId = toUuid(l.mod_id);
      const modName = typeof l.mod_name === "string" ? l.mod_name.trim() : "";
      if (!modId) return NextResponse.json({ error: "mod_id is required" }, { status: 400 });
      if (!modName) return NextResponse.json({ error: "mod_name is required" }, { status: 400 });
    }

    if (customer_is_staff) {
      if (!staff_customer_id || staff_customer_id <= 0) {
        return NextResponse.json({ error: "staff_customer_id is required for staff sales" }, { status: 400 });
      }
      // Voucher not allowed on staff sales (existing rule)
      if (voucher_used > 0) {
        return NextResponse.json({ error: "voucher_used is not allowed for staff sales" }, { status: 400 });
      }
    }

    // Detect raffle ticket quantity (sum of quantities)
    const raffleTickets = lines.reduce((sum, l) => {
      if (!isRaffleTicketLine(l.mod_name)) return sum;
      return sum + Math.max(0, toNumber(l.quantity, 0));
    }, 0);

    const hasRaffleTickets = raffleTickets > 0;

    // ✅ If raffle exists, force-disable discount inputs but DO NOT BLOCK THE SALE.
    const forcedDiscountId: number | null = hasRaffleTickets ? null : discount_id;
    const forcedVoucherUsed = hasRaffleTickets ? 0 : voucher_used;

    // -------------------------
    // SERVER-TRUSTED SUBTOTAL
    // -------------------------
    const computedSubtotal = roundToCents(
      lines.reduce((sum, l) => sum + toNumber(l.quantity) * toNumber(l.computed_price), 0)
    );

    // ✅ Blacklist multiplier only for real customers (never staff sale)
    const blacklistMultiplier = customer_is_staff ? 1 : await getBlacklistMultiplier(customer_id);

    // ✅ Staff discount applies ONLY if NOT raffle
    const staffDiscountEligible = customer_is_staff && !hasRaffleTickets;

    // -------------------------
    // Discount percent (normal customer only)
    // -------------------------
    let discountPercent = 0;

    if (!customer_is_staff && forcedDiscountId) {
      const { data: disc, error: discErr } = await supabaseServer
        .from("discounts")
        .select("percent")
        .eq("id", forcedDiscountId)
        .maybeSingle();

      if (discErr) {
        console.error("POST /api/orders discount lookup error:", discErr);
        return NextResponse.json({ error: "Failed to load discount" }, { status: 500 });
      }

      discountPercent = Number(disc?.percent ?? 0);
    }

    // ✅ membership discount (10%) and use MAX — but NOT for raffle
    const membershipPercent =
      !customer_is_staff && !hasRaffleTickets ? await getMembershipDiscountPercent(customer_id) : 0;

    const effectiveDiscountPercent =
      !customer_is_staff && !hasRaffleTickets ? Math.max(discountPercent, membershipPercent) : 0;

    // -------------------------
    // Compute totals (pre-blacklist)
    // -------------------------
    let discountAmount = roundToCents((computedSubtotal * effectiveDiscountPercent) / 100);
    let rawTotal = roundToCents(computedSubtotal - discountAmount);
    let total = Math.ceil(rawTotal);

    // ✅ Apply staff 25% discount ONLY if eligible (NOT raffle)
    if (staffDiscountEligible) {
      const staffSubtotal = roundToCents(computedSubtotal * 0.75);
      discountAmount = roundToCents(computedSubtotal - staffSubtotal);
      rawTotal = roundToCents(computedSubtotal - discountAmount);
      total = Math.ceil(rawTotal);
    }

    // ✅ Apply blacklist multiplier to stored totals AND line unit prices
    const finalSubtotal = roundToCents(computedSubtotal * blacklistMultiplier);
    const finalDiscountAmount = roundToCents(discountAmount * blacklistMultiplier);
    const finalTotal = Math.ceil(total * blacklistMultiplier);

    // ✅ Voucher rules: only for real customers AND not raffle AND not staff
    let safeVoucherUsed = 0;

    if (!customer_is_staff && !hasRaffleTickets && customer_id && forcedVoucherUsed > 0) {
      const { data: cust, error: custErr } = await supabaseServer
        .from("customers")
        .select("voucher_amount")
        .eq("id", customer_id)
        .maybeSingle();

      if (custErr) {
        console.error("Voucher lookup error:", custErr);
        return NextResponse.json({ error: "Failed to load voucher balance" }, { status: 500 });
      }

      const balance = roundToCents(Math.max(0, Number(cust?.voucher_amount ?? 0)));
      safeVoucherUsed = roundToCents(Math.min(balance, Math.max(0, finalTotal), forcedVoucherUsed));
    }

    const voucherNote =
      safeVoucherUsed > 0
        ? ` [VOUCHER_USED=$${safeVoucherUsed.toFixed(2)} | CARD_CHARGE=$${roundToCents(finalTotal - safeVoucherUsed).toFixed(2)}]`
        : "";

    const flagsNoteParts: string[] = [];
    if (blacklistMultiplier === 2) flagsNoteParts.push("[BLACKLISTED x2]");
    if (hasRaffleTickets) flagsNoteParts.push("[RAFFLE_NO_DISCOUNTS]");

    const prefix = flagsNoteParts.length ? `${flagsNoteParts.join(" ")} ` : "";
    const finalNote = prefix + (note ?? "");
    const savedNote = (finalNote + voucherNote).trim() ? (finalNote + voucherNote).trim() : null;

    // -------------------------
    // Create order (PAID)
    // -------------------------
    const { data: order, error: orderErr } = await supabaseServer
      .from("orders")
      .insert({
        status: "paid",
        vehicle_id,
        staff_id,

        customer_id: customer_is_staff ? null : customer_id,
        staff_customer_id: customer_is_staff ? staff_customer_id : null,
        customer_is_staff: customer_is_staff,

        discount_id: customer_is_staff ? null : forcedDiscountId,

        vehicle_base_price,
        plate,

        subtotal: finalSubtotal,
        discount_amount: finalDiscountAmount,
        total: finalTotal,

        note: savedNote,
      })
      .select("id, created_at")
      .single();

    if (orderErr || !order) {
      console.error("POST /api/orders order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const order_id = order.id as string;
    const order_created_at = typeof (order as any)?.created_at === "string" ? (order as any).created_at : null;

    // Insert order lines (blacklist doubles unit_price)
    const lineRows = lines.map((l) => ({
      order_id,
      vehicle_id,
      mod_id: toUuid(l.mod_id),
      mod_name: String(l.mod_name ?? "").trim(),
      quantity: toNumber(l.quantity, 1),
      unit_price: roundToCents(toNumber(l.computed_price) * blacklistMultiplier),
      pricing_type: l.pricing_type,
      pricing_value: toNumber(l.pricing_value),
    }));

    const { error: linesErr } = await supabaseServer.from("order_lines").insert(lineRows);

    if (linesErr) {
      console.error("POST /api/orders lines insert error:", linesErr);
      await supabaseServer.from("orders").delete().eq("id", order_id);
      return NextResponse.json({ error: "Failed to create order lines" }, { status: 500 });
    }

    // ✅ Append raffle log AFTER successful order+lines
    if (hasRaffleTickets) {
      await writeRaffleSalesLog({
        order_id,
        staff_id,
        sold_at: order_created_at,
        customer_is_staff,
        customer_id: customer_is_staff ? null : customer_id,
        staff_customer_id: customer_is_staff ? staff_customer_id : null,
        raffleTickets,
      });
    }

    // ✅ Deduct voucher balance AFTER successful order+lines (if allowed)
    if (!customer_is_staff && !hasRaffleTickets && customer_id && safeVoucherUsed > 0) {
      const { data: cust, error: custErr } = await supabaseServer
        .from("customers")
        .select("voucher_amount")
        .eq("id", customer_id)
        .maybeSingle();

      if (custErr) {
        console.error("Voucher reload error:", custErr);
      } else {
        const current = roundToCents(Math.max(0, Number(cust?.voucher_amount ?? 0)));
        const next = roundToCents(Math.max(0, current - safeVoucherUsed));

        const { error: updErr } = await supabaseServer
          .from("customers")
          .update({ voucher_amount: next })
          .eq("id", customer_id);

        if (updErr) console.error("Voucher deduct update error:", updErr);
      }
    }

    return NextResponse.json({ order_id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/orders fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
