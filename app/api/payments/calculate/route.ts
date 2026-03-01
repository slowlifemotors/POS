// app/api/payments/calculate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

function isRaffleTicketLine(modName: unknown) {
  const s = typeof modName === "string" ? modName.trim().toLowerCase() : "";
  return s === "raffle ticket";
}

/* ---------------------------------------------------------
   PAY PERIOD
   ✅ New Rule:
   - Start is EXACTLY the last payment's period_end (exclusive)
   - End is current time (now)

   Fallback:
   - If never paid before, start at 1st of current month
--------------------------------------------------------- */
async function getPayPeriod(staff_id: number) {
  const { data: last, error } = await supabase
    .from("payments")
    .select("period_end")
    .eq("staff_id", staff_id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getPayPeriod error:", error);
  }

  const now = new Date();

  const lastEnd = last?.period_end ? new Date(last.period_end) : null;

  // If lastEnd is invalid or somehow in the future, ignore it
  const hasValidLastEnd =
    !!lastEnd && Number.isFinite(lastEnd.getTime()) && lastEnd.getTime() < now.getTime();

  const period_start = hasValidLastEnd
    ? lastEnd!
    : new Date(now.getFullYear(), now.getMonth(), 1);

  // Exclusive start to prevent double counting the boundary
  const period_start_exclusive = new Date(period_start.getTime() + 1);

  return { period_start, period_start_exclusive, period_end: now };
}

/* ---------------------------------------------------------
   HOURS WORKED
   ✅ Use period_start_exclusive with .gt() to avoid overlap
--------------------------------------------------------- */
async function getHours(staff_id: number, startExclusive: Date, end: Date) {
  const { data, error } = await supabase
    .from("timesheets")
    .select("hours_worked")
    .eq("staff_id", staff_id)
    .gt("clock_in", startExclusive.toISOString())
    .lte("clock_in", end.toISOString());

  if (error) {
    console.error("getHours error:", error);
    return 0;
  }

  return data?.reduce((s, r) => s + Number((r as any).hours_worked || 0), 0) ?? 0;
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
   COMMISSION
   GAME RULE:
   - profit = order.total / 2

   IMPORTANT:
   - Staff sales MUST NOT count toward commission

   ✅ RAFFLE RULE:
   - Raffle tickets IGNORE normal commission rate
   - Raffle commission is ALWAYS 20% of ticket sale price
   - Normal commission is computed on PROFIT EXCLUDING raffle revenue

   ✅ Use period_start_exclusive with .gt() to avoid overlap
--------------------------------------------------------- */
async function getCommission(
  staff_id: number,
  commission_rate: number,
  startExclusive: Date,
  end: Date
) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total, status, customer_is_staff")
    .eq("staff_id", staff_id)
    .eq("status", "paid")
    .eq("customer_is_staff", false)
    .gt("created_at", startExclusive.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error("getCommission orders error:", error);
    return { rate: Number(commission_rate || 0), profit: 0, value: 0 };
  }

  if (!orders || orders.length === 0) {
    return { rate: Number(commission_rate || 0), profit: 0, value: 0 };
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

    const nonRaffleTotal = Math.max(0, total - raffleRevenue);
    totalProfitExRaffle += nonRaffleTotal / 2;
  }

  const normalCommissionValue =
    totalProfitExRaffle * (Number(commission_rate || 0) / 100);

  const raffleCommissionValue = raffleRevenueTotal * 0.2;

  const totalCommissionValue = normalCommissionValue + raffleCommissionValue;

  return {
    rate: Number(commission_rate || 0),
    profit: totalProfitExRaffle,
    value: totalCommissionValue,
  };
}

/* ---------------------------------------------------------
   MAIN ENDPOINT
--------------------------------------------------------- */
export async function GET(req: Request) {
  const session = await getSession();

  if (!session?.staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterRole = String(session.staff.role || "").toLowerCase();
  if (!["admin", "owner", "manager"].includes(requesterRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const staff_id = Number(searchParams.get("staff_id"));

  if (!staff_id) {
    return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
  }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("role_id")
    .eq("id", staff_id)
    .single();

  if (!staffRow) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const { data: roleRow } = await supabase
    .from("roles")
    .select("name, hourly_rate, commission_rate")
    .eq("id", staffRow.role_id)
    .single();

  const hourly_rate = Number(roleRow?.hourly_rate ?? 0);
  const commission_rate = Number(roleRow?.commission_rate ?? 0);

  const { period_start, period_start_exclusive, period_end } =
    await getPayPeriod(staff_id);

  const hours = await getHours(staff_id, period_start_exclusive, period_end);
  const hourly_pay = hours * hourly_rate;

  const commission = await getCommission(
    staff_id,
    commission_rate,
    period_start_exclusive,
    period_end
  );

  const total_pay = Math.max(0, hourly_pay + commission.value);

  return NextResponse.json({
    staff_id,
    period: {
      start: period_start.toISOString(),
      end: period_end.toISOString(),
    },
    hours: {
      total: hours,
      hourly_rate,
      hourly_pay,
    },
    commission: {
      rate: commission.rate,
      profit: commission.profit,
      value: commission.value,
    },
    total_pay,
  });
}