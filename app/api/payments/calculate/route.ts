// app/api/payments/calculate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

/* ---------------------------------------------------------
   PAY PERIOD
--------------------------------------------------------- */
async function getPayPeriod(staff_id: number) {
  const { data: last } = await supabase
    .from("payments")
    .select("period_end")
    .eq("staff_id", staff_id)
    .order("period_end", { ascending: false })
    .limit(1)
    .single();

  const now = new Date();

  const period_start = last?.period_end
    ? new Date(last.period_end)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  return { period_start, period_end: now };
}

/* ---------------------------------------------------------
   HOURS WORKED
--------------------------------------------------------- */
async function getHours(staff_id: number, start: Date, end: Date) {
  const { data } = await supabase
    .from("timesheets")
    .select("hours_worked")
    .eq("staff_id", staff_id)
    .gte("clock_in", start.toISOString())
    .lte("clock_in", end.toISOString());

  return data?.reduce((s, r) => s + Number(r.hours_worked || 0), 0) ?? 0;
}

/* ---------------------------------------------------------
   COMMISSION
   USING COGS PROFIT WITH PROPORTIONAL DISCOUNT ALLOCATION
--------------------------------------------------------- */
async function getCommission(
  staff_id: number,
  role_name: string,
  start: Date,
  end: Date
) {
  // Load commission rate
  const { data: rateRow } = await supabase
    .from("commission_rates")
    .select("rate")
    .eq("role", role_name.toLowerCase())
    .single();

  const rate = Number(rateRow?.rate ?? 0);

  // Load all sales in period
  const { data: sales } = await supabase
    .from("sales")
    .select("id, final_total, original_total, refunded")
    .eq("staff_id", staff_id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (!sales || sales.length === 0) {
    return { rate, profit: 0, value: 0 };
  }

  let totalProfit = 0;

  for (const sale of sales) {
    if (sale.refunded) continue;

    const saleId = sale.id;
    const originalTotal = Number(sale.original_total || 0);
    const finalTotal = Number(sale.final_total || 0);
    const discountLoss = Math.max(0, originalTotal - finalTotal);

    // Load sale items for this sale
    const { data: items } = await supabase
      .from("sale_items")
      .select("item_id, quantity, price_each, subtotal")
      .eq("sale_id", saleId);

    if (!items || items.length === 0) continue;

    const sumSubtotals = items.reduce(
      (s, i) => s + Number(i.subtotal || 0),
      0
    );

    if (sumSubtotals <= 0) continue;

    // Load cost_price for each item
    const itemIds = items.map((i) => i.item_id);
    const { data: products } = await supabase
      .from("items")
      .select("id, cost_price")
      .in("id", itemIds);

    const costMap: Record<number, number> = {};
    products?.forEach((p) => {
      costMap[p.id] = Number(p.cost_price || 0);
    });

    // Calculate per-item COGS profit with proportional discount deduction
    for (const item of items) {
      const qty = Number(item.quantity || 0);
      const priceEach = Number(item.price_each || 0);
      const subtotal = Number(item.subtotal || 0);
      const cost = costMap[item.item_id] ?? 0;

      const itemBaseProfit = (priceEach - cost) * qty;

      const itemDiscountShare = (subtotal / sumSubtotals) * discountLoss;

      const itemTrueProfit = Math.max(0, itemBaseProfit - itemDiscountShare);

      totalProfit += itemTrueProfit;
    }
  }

  const commissionValue = totalProfit * (rate / 100);

  return {
    rate,
    profit: totalProfit,
    value: commissionValue,
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

  const requesterRole = session.staff.role.toLowerCase();
  if (!["admin", "owner", "manager"].includes(requesterRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const staff_id = Number(searchParams.get("staff_id"));

  if (!staff_id) {
    return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
  }

  // Load staff role
  const { data: staffRow } = await supabase
    .from("staff")
    .select("role_id")
    .eq("id", staff_id)
    .single();

  if (!staffRow) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const { data: rolesRow } = await supabase
    .from("roles")
    .select("name, hourly_rate")
    .eq("id", staffRow.role_id)
    .single();

  const role_name = rolesRow?.name?.toLowerCase() ?? "staff";
  const hourly_rate = Number(rolesRow?.hourly_rate ?? 0);

  // Pay period
  const { period_start, period_end } = await getPayPeriod(staff_id);

  // Hours worked
  const hours = await getHours(staff_id, period_start, period_end);
  const hourly_pay = hours * hourly_rate;

  // Commission (COGS-based)
  const commission = await getCommission(
    staff_id,
    role_name,
    period_start,
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
