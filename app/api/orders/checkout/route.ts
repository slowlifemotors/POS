// app/api/orders/checkout/route.ts
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
  computed_price: number; // unit sale price
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
  return cleaned.length > 20 ? cleaned.slice(0, 20) : cleaned;
}
function isDateString(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x);
}
function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}
function isRaffleTicketLine(modName: unknown) {
  const s = typeof modName === "string" ? modName.trim().toLowerCase() : "";
  return s === "raffle ticket";
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
    return 1;
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
    return 0;
  }

  if (!data?.membership_active) return 0;

  const start = data.membership_start as unknown;
  const end = data.membership_end as unknown;

  if (!isDateString(start) || !isDateString(end)) return 10;

  const t = todayYMD();
  return start <= t && t <= end ? 10 : 0;
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

  if (error) console.error("writeRaffleSalesLog insert error:", error);
}

/**
 * POST /api/orders/checkout
 * Finalizes an OPEN order into PAID.
 *
 * Body:
 * {
 *   order_id: string,
 *   staff_id: number,
 *   vehicle_id: number,
 *   customer_id: number|null,
 *   staff_customer_id: number|null,
 *   customer_is_staff: boolean,
 *   discount_id: number|null,
 *   vehicle_base_price: number,
 *   plate: string|null,
 *   note: string|null,
 *   voucher_used: number, // optional, server will clamp
 *   lines: IncomingLine[]
 * }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.staff) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    const order_id = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    if (!order_id) return NextResponse.json({ error: "order_id is required" }, { status: 400 });

    const staff_id = toNumber(body?.staff_id);
    if (!staff_id || staff_id !== session.staff.id) {
      return NextResponse.json({ error: "Invalid staff_id" }, { status: 400 });
    }

    // verify order is open and owned by staff
    const { data: existing, error: eErr } = await supabaseServer
      .from("orders")
      .select("id, status, staff_id, created_at")
      .eq("id", order_id)
      .maybeSingle();

    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (String(existing.status ?? "").toLowerCase() !== "open") {
      return NextResponse.json({ error: "Order is not open" }, { status: 400 });
    }
    if (Number(existing.staff_id) !== staff_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    if (!vehicle_id) return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines is required" }, { status: 400 });
    }

    for (const l of lines) {
      if (toNumber(l.vehicle_id) !== vehicle_id) {
        return NextResponse.json({ error: "All lines must match vehicle_id" }, { status: 400 });
      }

      const qty = toNumber(l.quantity);
      if (!qty || qty < 1) return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });

      const unit = toNumber(l.computed_price);
      if (unit < 0) return NextResponse.json({ error: "computed_price must be >= 0" }, { status: 400 });

      const pt = l.pricing_type;
      if (pt !== "percentage" && pt !== "flat") {
        return NextResponse.json({ error: "Invalid pricing_type" }, { status: 400 });
      }

      const pv = toNumber(l.pricing_value);
      if (pv < 0) return NextResponse.json({ error: "pricing_value must be >= 0" }, { status: 400 });
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
      if (voucher_used > 0) {
        return NextResponse.json({ error: "voucher_used is not allowed for staff sales" }, { status: 400 });
      }
    }

    // raffle detection
    const raffleTickets = lines.reduce((sum, l) => {
      if (!isRaffleTicketLine(l.mod_name)) return sum;
      return sum + Math.max(0, toNumber(l.quantity, 0));
    }, 0);

    const hasRaffleTickets = raffleTickets > 0;

    // raffle forces discount/voucher off
    const forcedDiscountId: number | null = hasRaffleTickets ? null : discount_id;
    const forcedVoucherUsed = hasRaffleTickets ? 0 : voucher_used;

    // trusted subtotal
    const computedSubtotal = roundToCents(
      lines.reduce((sum, l) => sum + toNumber(l.quantity) * toNumber(l.computed_price), 0)
    );

    // blacklist multiplier only for real customers
    const blacklistMultiplier = customer_is_staff ? 1 : await getBlacklistMultiplier(customer_id);

    // staff discount only if NOT raffle
    const staffDiscountEligible = customer_is_staff && !hasRaffleTickets;

    // discount percent only for real customers
    let discountPercent = 0;
    if (!customer_is_staff && forcedDiscountId) {
      const { data: disc, error: discErr } = await supabaseServer
        .from("discounts")
        .select("percent")
        .eq("id", forcedDiscountId)
        .maybeSingle();

      if (discErr) {
        console.error("CHECKOUT discount lookup error:", discErr);
        return NextResponse.json({ error: "Failed to load discount" }, { status: 500 });
      }

      discountPercent = Number(disc?.percent ?? 0);
    }

    const membershipPercent =
      !customer_is_staff && !hasRaffleTickets ? await getMembershipDiscountPercent(customer_id) : 0;

    const effectiveDiscountPercent =
      !customer_is_staff && !hasRaffleTickets ? Math.max(discountPercent, membershipPercent) : 0;

    let discountAmount = roundToCents((computedSubtotal * effectiveDiscountPercent) / 100);
    let rawTotal = roundToCents(computedSubtotal - discountAmount);
    let total = Math.ceil(rawTotal);

    if (staffDiscountEligible) {
      const staffSubtotal = roundToCents(computedSubtotal * 0.75);
      discountAmount = roundToCents(computedSubtotal - staffSubtotal);
      rawTotal = roundToCents(computedSubtotal - discountAmount);
      total = Math.ceil(rawTotal);
    }

    const finalSubtotal = roundToCents(computedSubtotal * blacklistMultiplier);
    const finalDiscountAmount = roundToCents(discountAmount * blacklistMultiplier);
    const finalTotal = Math.ceil(total * blacklistMultiplier);

    // voucher allowed: only real customers and not raffle
    let safeVoucherUsed = 0;

    if (!customer_is_staff && !hasRaffleTickets && customer_id && forcedVoucherUsed > 0) {
      const { data: cust, error: custErr } = await supabaseServer
        .from("customers")
        .select("voucher_amount")
        .eq("id", customer_id)
        .maybeSingle();

      if (custErr) return NextResponse.json({ error: "Failed to load voucher balance" }, { status: 500 });

      const balance = roundToCents(Math.max(0, Number(cust?.voucher_amount ?? 0)));
      safeVoucherUsed = roundToCents(Math.min(balance, Math.max(0, finalTotal), forcedVoucherUsed));
    }

    const voucherNote =
      safeVoucherUsed > 0
        ? ` [VOUCHER_USED=$${safeVoucherUsed.toFixed(2)} | CARD_CHARGE=$${roundToCents(finalTotal - safeVoucherUsed).toFixed(2)}]`
        : "";

    const flags: string[] = [];
    if (blacklistMultiplier === 2) flags.push("[BLACKLISTED x2]");
    if (hasRaffleTickets) flags.push("[RAFFLE_NO_DISCOUNTS]");

    const prefix = flags.length ? `${flags.join(" ")} ` : "";
    const finalNote = prefix + (note ?? "");
    const savedNote = (finalNote + voucherNote).trim() ? (finalNote + voucherNote).trim() : null;

    // replace lines
    const { error: delErr } = await supabaseServer.from("order_lines").delete().eq("order_id", order_id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

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

    const { error: insErr } = await supabaseServer.from("order_lines").insert(lineRows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // update order -> paid
    const { data: updated, error: updErr } = await supabaseServer
      .from("orders")
      .update({
        status: "paid",
        vehicle_id,
        staff_id,

        customer_id: customer_is_staff ? null : customer_id,
        staff_customer_id: customer_is_staff ? staff_customer_id : null,
        customer_is_staff,

        discount_id: customer_is_staff ? null : forcedDiscountId,

        vehicle_base_price,
        plate,

        subtotal: finalSubtotal,
        discount_amount: finalDiscountAmount,
        total: finalTotal,

        note: savedNote,
      })
      .eq("id", order_id)
      .select("id, created_at")
      .single();

    if (updErr || !updated) return NextResponse.json({ error: "Failed to finalize order" }, { status: 500 });

    const sold_at = typeof (updated as any)?.created_at === "string" ? (updated as any).created_at : null;

    // raffle log after successful finalize
    if (hasRaffleTickets) {
      await writeRaffleSalesLog({
        order_id,
        staff_id,
        sold_at,
        customer_is_staff,
        customer_id: customer_is_staff ? null : customer_id,
        staff_customer_id: customer_is_staff ? staff_customer_id : null,
        raffleTickets,
      });
    }

    // deduct voucher after successful finalize
    if (!customer_is_staff && !hasRaffleTickets && customer_id && safeVoucherUsed > 0) {
      const { data: cust, error: custErr } = await supabaseServer
        .from("customers")
        .select("voucher_amount")
        .eq("id", customer_id)
        .maybeSingle();

      if (!custErr) {
        const current = roundToCents(Math.max(0, Number(cust?.voucher_amount ?? 0)));
        const next = roundToCents(Math.max(0, current - safeVoucherUsed));

        const { error: updVErr } = await supabaseServer
          .from("customers")
          .update({ voucher_amount: next })
          .eq("id", customer_id);

        if (updVErr) console.error("Voucher deduct update error:", updVErr);
      }
    }

    return NextResponse.json({ success: true, order_id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/orders/checkout fatal:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
