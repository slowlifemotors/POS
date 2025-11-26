// app/api/timesheet/summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// Monday → Sunday week boundaries
function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon...

  const adjusted = day === 0 ? 7 : day;

  const monday = new Date(now);
  monday.setDate(now.getDate() - (adjusted - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const role = session.staff.role.toLowerCase();
    const isAdmin = role === "admin" || role === "owner";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const staffId = Number(searchParams.get("staff_id"));

    if (!staffId) {
      return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const { monday: weekStart, sunday: weekEnd } = getWeekRange();

    // ─────────────────────────────
    // WEEK SUMMARY
    // ─────────────────────────────
    const { data: weekRows } = await supabase
      .from("timesheets")
      .select("hours_worked")
      .eq("staff_id", staffId)
      .gte("clock_in", weekStart.toISOString())
      .lte("clock_in", weekEnd.toISOString());

    const weeklyHours =
      weekRows?.reduce((sum, r) => sum + (r.hours_worked || 0), 0) || 0;
    const weeklyShifts = weekRows?.length || 0;

    // ─────────────────────────────
    // MONTH SUMMARY
    // ─────────────────────────────
    const { data: monthRows } = await supabase
      .from("timesheets")
      .select("hours_worked")
      .eq("staff_id", staffId)
      .gte("clock_in", monthStart.toISOString())
      .lte("clock_in", monthEnd.toISOString());

    const monthlyHours =
      monthRows?.reduce((sum, r) => sum + (r.hours_worked || 0), 0) || 0;
    const monthlyShifts = monthRows?.length || 0;

    const avgShiftHours =
      monthlyShifts > 0 ? monthlyHours / monthlyShifts : 0;

    // ─────────────────────────────
    // CLEAN RESPONSE FORMAT (FIX)
    // ─────────────────────────────
    return NextResponse.json({
      weekly_hours: weeklyHours,
      weekly_shifts: weeklyShifts,
      monthly_hours: monthlyHours,
      monthly_shifts: monthlyShifts,
      avg_shift_hours: avgShiftHours,
    });
  } catch (err) {
    console.error("Admin summary fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
