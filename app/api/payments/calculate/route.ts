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
    .maybeSingle();

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
   GAME RULE:
   - Checkout price is doubled (profit is exactly half of what customer pays)
   - Discounts apply to whole sale -> profit is half of FINAL TOTAL
   => profit = order.total / 2
--------------------------------------------------------- */
async function getCommission(
  staff_id: number,
  commission_rate: number,
  start: Date,
  end: Date
) {
  // Load all PAID orders for staff in period
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total, status")
    .eq("staff_id", staff_id)
    .eq("status", "paid")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    console.error("getCommission orders error:", error);
    return { rate: commission_rate, profit: 0, value: 0 };
  }

  if (!orders || orders.length === 0) {
    return { rate: commission_rate, profit: 0, value: 0 };
  }

  // Profit is half of what customer paid (after discount)
  let totalProfit = 0;

  for (const o of orders) {
    const total = Number(o.total || 0);
    if (total <= 0) continue;
    totalProfit += total / 2;
  }

  const commissionValue = totalProfit * (Number(commission_rate || 0) / 100);

  return {
    rate: Number(commission_rate || 0),
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

  const requesterRole = String(session.staff.role || "").toLowerCase();
  if (!["admin", "owner", "manager"].includes(requesterRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const staff_id = Number(searchParams.get("staff_id"));

  if (!staff_id) {
    return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
  }

  // Load staff role + hourly_rate + commission_rate from roles
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

  // Pay period
  const { period_start, period_end } = await getPayPeriod(staff_id);

  // Hours worked
  const hours = await getHours(staff_id, period_start, period_end);
  const hourly_pay = hours * hourly_rate;

  // Commission (profit-based per game rules)
  const commission = await getCommission(
    staff_id,
    commission_rate,
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
