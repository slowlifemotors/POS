// app/api/payments/my-period-metrics/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

function isRaffleTicketLine(modName: unknown) {
  const s = typeof modName === "string" ? modName.trim().toLowerCase() : "";
  return s === "raffle ticket";
}

/* ---------------------------------------------------------
   PAY PERIOD (same logic as payments/calculate)
--------------------------------------------------------- */
async function getPayPeriod(staff_id: number) {
  const { data: last } = await supabase
    .from("payments")
    .select("period_end")
    .eq("staff_id", staff_id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  const period_start = last?.period_end
    ? new Date(last.period_end)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  return { period_start, period_end: now };
}

/* ---------------------------------------------------------
   RAFFLE REVENUE MAP (per order)
   - Excludes voided lines
--------------------------------------------------------- */
async function getRaffleRevenueByOrderId(orderIds: string[]) {
  const map = new Map<string, number>();
  if (!orderIds.length) return map;

  const { data, error } = await supabase
    .from("order_lines")
    .select("order_id, mod_name, quantity, unit_price, is_voided")
    .in("order_id", orderIds)
    .eq("is_voided", false);

  if (error) {
    console.error("getRaffleRevenueByOrderId error:", error);
    return map;
  }

  for (const row of data ?? []) {
    const oid = String((row as any).order_id ?? "");
    if (!oid) continue;

    if (!isRaffleTicketLine((row as any).mod_name)) continue;

    const qty = Number((row as any).quantity ?? 0);
    const unit = Number((row as any).unit_price ?? 0);
    if (qty <= 0 || unit <= 0) continue;

    const cur = map.get(oid) ?? 0;
    map.set(oid, roundToCents(cur + qty * unit));
  }

  return map;
}

/* ---------------------------------------------------------
   PROFIT + COMMISSION
   GAME RULE:
   - Checkout price is doubled => profit is half of what customer pays
   - Discounts apply to whole sale => profit is half of FINAL TOTAL
   => profit = order.total / 2

   IMPORTANT:
   - Staff sales (customer_is_staff=true) MUST NOT count

   ✅ RAFFLE RULE:
   - Raffle tickets IGNORE normal commission rate
   - Raffle commission is ALWAYS 20% of ticket sale price
   - Normal commission is computed on PROFIT EXCLUDING raffle revenue
--------------------------------------------------------- */
async function getProfitAndCommission(
  staff_id: number,
  commission_rate: number,
  start: Date,
  end: Date
) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total, status, customer_is_staff")
    .eq("staff_id", staff_id)
    .eq("status", "paid")
    .eq("customer_is_staff", false)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error("Profit/Commission orders error:", error);
    return { profit: 0, commission: 0, orders_count: 0 };
  }

  if (!orders || orders.length === 0) {
    return { profit: 0, commission: 0, orders_count: 0 };
  }

  const orderIds = orders.map((o: any) => String(o.id)).filter(Boolean);
  const raffleByOrder = await getRaffleRevenueByOrderId(orderIds);

  let totalProfitExRaffle = 0;
  let raffleRevenueTotal = 0;

  for (const o of orders) {
    const orderId = String((o as any).id ?? "");
    const total = Number((o as any).total || 0);
    if (!orderId || total <= 0) continue;

    const raffleRevenue = Number(raffleByOrder.get(orderId) ?? 0);
    raffleRevenueTotal += raffleRevenue;

    // Normal profit base excludes raffle revenue
    const nonRaffleTotal = Math.max(0, total - raffleRevenue);
    totalProfitExRaffle += nonRaffleTotal / 2;
  }

  const normalCommissionValue =
    totalProfitExRaffle * (Number(commission_rate || 0) / 100);

  // ✅ Raffle commission: 20% of ticket sale price
  const raffleCommissionValue = raffleRevenueTotal * 0.2;

  const totalCommissionValue = normalCommissionValue + raffleCommissionValue;

  return {
    profit: totalProfitExRaffle,
    commission: totalCommissionValue,
    orders_count: orders.length,
  };
}

/* ---------------------------------------------------------
   MAIN
--------------------------------------------------------- */
export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedStaffId = searchParams.get("staff_id");

    const privileged = isManagerOrAbove(session.staff.role);

    // Default: staff can always fetch their own metrics
    const staff_id =
      privileged && requestedStaffId
        ? Number(requestedStaffId)
        : Number(session.staff.id);

    if (!staff_id) {
      return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
    }

    // If non-privileged tries to fetch another staff member, block
    if (!privileged && staff_id !== Number(session.staff.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find staff role -> commission_rate
    const { data: staffRow, error: staffErr } = await supabase
      .from("staff")
      .select("role_id")
      .eq("id", staff_id)
      .single();

    if (staffErr || !staffRow) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const { data: roleRow, error: roleErr } = await supabase
      .from("roles")
      .select("commission_rate")
      .eq("id", staffRow.role_id)
      .single();

    if (roleErr) {
      console.error("Role fetch error:", roleErr);
    }

    const commission_rate = Number(roleRow?.commission_rate ?? 0);

    const { period_start, period_end } = await getPayPeriod(staff_id);

    const { profit, commission, orders_count } = await getProfitAndCommission(
      staff_id,
      commission_rate,
      period_start,
      period_end
    );

    return NextResponse.json({
      staff_id,
      period: {
        start: period_start.toISOString(),
        end: period_end.toISOString(),
      },
      commission_rate,
      profit,
      commission,
      orders_count,
    });
  } catch (err) {
    console.error("my-period-metrics fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
