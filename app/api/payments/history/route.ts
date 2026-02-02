// app/api/payments/history/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(session.staff.role || "").toLowerCase();
    const isPrivileged = ["admin", "owner", "manager"].includes(role);

    // Parse query params
    const { searchParams } = new URL(req.url);
    const staffId = Number(searchParams.get("staff_id"));

    if (!staffId) {
      return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
    }

    // Non-admin cannot view other people's history
    if (!isPrivileged && staffId !== session.staff.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch payment rows
    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Payment history error:", error);
      return NextResponse.json({ history: [] });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ history: [] });
    }

    // Collect all staff IDs referenced (staff + paid_by)
    const staffIds = [
      ...new Set([
        ...payments.map((p) => p.staff_id),
        ...payments.map((p) => p.paid_by),
      ]),
    ];

    // Load staff names
    const { data: staffRows, error: staffErr } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);

    if (staffErr) {
      console.error("Staff fetch error:", staffErr);
    }

    const staffMap: Record<number, string> = {};
    staffRows?.forEach((s) => (staffMap[s.id] = s.name));

    // Enrich payment records
    const enriched = payments.map((p) => ({
      id: p.id,
      staff_id: p.staff_id,
      staff_name: staffMap[p.staff_id] || "Unknown",

      paid_by: p.paid_by,
      paid_by_name: staffMap[p.paid_by] || "Unknown",

      period_start: p.period_start,
      period_end: p.period_end,

      hours_worked: Number(p.hours_worked),
      hourly_pay: Number(p.hourly_pay),

      // NEW fields (safe even if old rows have defaults)
      commission_rate: Number(p.commission_rate ?? 0),
      commission_profit: Number(p.commission_profit ?? 0),

      commission: Number(p.commission),
      total_paid: Number(p.total_paid),

      created_at: p.created_at,
    }));

    return NextResponse.json({ history: enriched });
  } catch (err) {
    console.error("Payment history fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
