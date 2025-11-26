// app/api/payments/confirm/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const session = await getSession();

    // Must be logged in
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole = session.staff.role.toLowerCase();

    // Only admin, owner, manager can pay someone
    if (!["admin", "owner", "manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request
    const body = await req.json();

    const {
      staff_id,
      period_start,
      period_end,

      // Hours
      hours,
      hourly_rate,
      hourly_pay,

      // Commission
      commission_rate,
      commission_profit,
      commission_value,

      // Total
      total_pay
    } = body;

    // Validate required fields
    const required = [
      staff_id,
      period_start,
      period_end,
      hours,
      hourly_rate,
      hourly_pay,
      commission_rate,
      commission_profit,
      commission_value,
      total_pay
    ];

    if (required.some((v) => v === undefined || v === null)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build payload for DB
    const insertPayload = {
      staff_id,
      paid_by: session.staff.id,
      period_start,
      period_end,
      hours_worked: hours,
      hourly_pay: hourly_pay,
      commission: commission_value,
      total_paid: total_pay
    };

    // Insert into payments table
    const { data, error } = await supabase
      .from("payments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Payment insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payment: data
    });

  } catch (err) {
    console.error("Payment confirm fatal error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
