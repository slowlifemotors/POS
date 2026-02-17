// app/api/orders/save/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type PricingType = "percentage" | "flat";

type IncomingLine = {
  vehicle_id: number; // may be 0/missing from old clients
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

async function getNoVehiclePlaceholderId(): Promise<number | null> {
  // matches your client-side isNoVehiclePlaceholder:
  // manufacturer="N/A", model="No Vehicle", base_price=0, category="N/A"
  const { data, error } = await supabaseServer
    .from("vehicles")
    .select("id, manufacturer, model, base_price, category")
    .ilike("manufacturer", "N/A")
    .ilike("model", "No Vehicle")
    .eq("base_price", 0)
    .ilike("category", "N/A")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getNoVehiclePlaceholderId error:", error);
    return null;
  }

  const id = data?.id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
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

/**
 * POST /api/orders/save
 * Creates or updates an OPEN order draft for the logged-in staff member.
 *
 * ✅ FIX:
 * - If vehicle_id is missing/0, we auto-use the "No Vehicle" placeholder vehicle.
 * - If any line.vehicle_id is missing/0, we auto-fill it with the resolved vehicle_id.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.staff) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));

    const order_id_in = typeof body?.order_id === "string" ? body.order_id.trim() : "";

    // staff id: backwards compatible
    const staff_id_in = toNumber(body?.staff_id, 0);
    const staff_id = staff_id_in > 0 ? staff_id_in : Number(session.staff.id);
    if (!staff_id || staff_id !== Number(session.staff.id)) {
      return NextResponse.json({ error: "Invalid staff_id" }, { status: 400 });
    }

    // ✅ vehicle id: allow missing -> use placeholder
    let vehicle_id = toNumber(body?.vehicle_id, 0);
    if (!vehicle_id) {
      const placeholderId = await getNoVehiclePlaceholderId();
      if (!placeholderId) {
        return NextResponse.json(
          { error: 'Missing vehicle_id and no "No Vehicle" placeholder row exists in vehicles table.' },
          { status: 400 }
        );
      }
      vehicle_id = placeholderId;
    }

    const customer_id =
      body?.customer_id === null || body?.customer_id === undefined ? null : toNumber(body.customer_id);

    const discount_id =
      body?.discount_id === null || body?.discount_id === undefined ? null : toNumber(body.discount_id);

    const customer_is_staff = Boolean(body?.customer_is_staff);

    const staff_customer_id =
      body?.staff_customer_id === null || body?.staff_customer_id === undefined
        ? null
        : toNumber(body.staff_customer_id);

    const vehicle_base_price = toNumber(body?.vehicle_base_price);
    const plate = normalizePlate(body?.plate);
    const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const lines: IncomingLine[] = Array.isArray(body?.lines) ? body.lines : [];
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines is required" }, { status: 400 });
    }

    // Validate + normalize lines
    for (const l of lines) {
      const lineVehicleId = toNumber((l as any)?.vehicle_id, 0);

      // ✅ if old client sends 0/missing line vehicle_id, auto-fill it
      if (!lineVehicleId) {
        (l as any).vehicle_id = vehicle_id;
      } else if (lineVehicleId !== vehicle_id) {
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
    }

    // raffle detection
    const raffleTickets = lines.reduce((sum, l) => {
      if (!isRaffleTicketLine(l.mod_name)) return sum;
      return sum + Math.max(0, toNumber(l.quantity, 0));
    }, 0);

    const hasRaffleTickets = raffleTickets > 0;
    const forcedDiscountId: number | null = hasRaffleTickets ? null : discount_id;

    const computedSubtotal = roundToCents(
      lines.reduce((sum, l) => sum + toNumber(l.quantity) * toNumber(l.computed_price), 0)
    );

    const blacklistMultiplier = customer_is_staff ? 1 : await getBlacklistMultiplier(customer_id);
    const staffDiscountEligible = customer_is_staff && !hasRaffleTickets;

    let discountPercent = 0;
    if (!customer_is_staff && forcedDiscountId) {
      const { data: disc, error: discErr } = await supabaseServer
        .from("discounts")
        .select("percent")
        .eq("id", forcedDiscountId)
        .maybeSingle();

      if (discErr) {
        console.error("SAVE draft discount lookup error:", discErr);
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

    const flags: string[] = [];
    if (blacklistMultiplier === 2) flags.push("[BLACKLISTED x2]");
    if (hasRaffleTickets) flags.push("[RAFFLE_NO_DISCOUNTS]");
    const savedNote = (flags.length ? `${flags.join(" ")} ` : "") + (note ?? "");
    const noteToSave = savedNote.trim() ? savedNote.trim() : null;

    // Update existing draft
    if (order_id_in) {
      const { data: existing, error: eErr } = await supabaseServer
        .from("orders")
        .select("id, status, staff_id")
        .eq("id", order_id_in)
        .maybeSingle();

      if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
      if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      if (String(existing.status ?? "").toLowerCase() !== "open") {
        return NextResponse.json({ error: "Only open jobs can be updated" }, { status: 400 });
      }
      if (Number(existing.staff_id) !== staff_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { error: updErr } = await supabaseServer
        .from("orders")
        .update({
          status: "open",
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

          note: noteToSave,
        })
        .eq("id", order_id_in);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      const { error: delErr } = await supabaseServer.from("order_lines").delete().eq("order_id", order_id_in);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      const lineRows = lines.map((l) => ({
        order_id: order_id_in,
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

      return NextResponse.json({ success: true, order_id: order_id_in }, { status: 200 });
    }

    // Create new draft
    const { data: order, error: orderErr } = await supabaseServer
      .from("orders")
      .insert({
        status: "open",
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

        note: noteToSave,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("SAVE draft order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to save job" }, { status: 500 });
    }

    const order_id = String(order.id);

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
      console.error("SAVE draft lines insert error:", linesErr);
      await supabaseServer.from("orders").delete().eq("id", order_id);
      return NextResponse.json({ error: "Failed to save job lines" }, { status: 500 });
    }

    return NextResponse.json({ success: true, order_id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/orders/save fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
