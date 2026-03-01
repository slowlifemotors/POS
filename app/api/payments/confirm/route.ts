// app/api/payments/confirm/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getNextPayPeriod(staff_id: number) {
  const { data: last, error } = await supabase
    .from("payments")
    .select("period_end")
    .eq("staff_id", staff_id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("confirm.getNextPayPeriod error:", error);
  }

  const now = new Date();

  const lastEnd = last?.period_end ? new Date(last.period_end) : null;
  const hasValidLastEnd =
    !!lastEnd &&
    Number.isFinite(lastEnd.getTime()) &&
    lastEnd.getTime() < now.getTime();

  const period_start = hasValidLastEnd
    ? lastEnd!
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const period_end = now;

  return {
    period_start: period_start.toISOString(),
    period_end: period_end.toISOString(),
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole = String(session.staff.role || "").toLowerCase();
    if (!["admin", "owner", "manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Only accept the financial numbers from client (period dates are server-owned)
    const staff_id = safeNumber(body.staff_id, 0);

    const hours = safeNumber(body.hours, 0);
    const hourly_rate = safeNumber(body.hourly_rate, 0);
    const hourly_pay = safeNumber(body.hourly_pay, 0);

    const commission_rate = safeNumber(body.commission_rate, 0);
    const commission_profit = safeNumber(body.commission_profit, 0);
    const commission_value = safeNumber(body.commission_value, 0);

    const total_pay = safeNumber(body.total_pay, 0);

    if (!staff_id) {
      return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
    }

    // ✅ Server computes the period boundaries
    const { period_start, period_end } = await getNextPayPeriod(staff_id);

    const insertPayload = {
      staff_id,
      paid_by: session.staff.id,

      period_start,
      period_end,

      hours_worked: hours,
      hourly_pay,

      commission_rate,
      commission_profit,
      commission: commission_value,

      total_paid: total_pay,
    };

    const { data, error } = await supabase
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Payment insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (err) {
    console.error("Payment confirm fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}