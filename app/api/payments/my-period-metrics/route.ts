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
   PROFIT + COMMISSION
   GAME RULE:
   - Checkout price is doubled => profit is half of what customer pays
   - Discounts apply to whole sale => profit is half of FINAL TOTAL
   => profit = order.total / 2

   IMPORTANT:
   - Staff sales (customer_is_staff=true) MUST NOT count
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

  let totalProfit = 0;

  for (const o of orders) {
    const total = Number((o as any).total || 0);
    if (total <= 0) continue;
    totalProfit += total / 2;
  }

  const commissionValue =
    totalProfit * (Number(commission_rate || 0) / 100);

  return {
    profit: totalProfit,
    commission: commissionValue,
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
