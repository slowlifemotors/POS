// app/api/timesheet/my-summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// Helper: Monday → Sunday start of week
function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon...

  // Convert Sunday (0) to 7 to properly compute Monday start
  const adjusted = day === 0 ? 7 : day;

  const monday = new Date(now);
  monday.setDate(now.getDate() - (adjusted - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const staffId = session.staff.id;
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { monday: weekStart, sunday: weekEnd } = getWeekRange();

    // ─────────────────────────────
    // WEEK SUMMARY
    // ─────────────────────────────
    const { data: weekRows, error: weekErr } = await supabase
      .from("timesheets")
      .select("hours_worked, clock_in")
      .eq("staff_id", staffId)
      .gte("clock_in", weekStart.toISOString())
      .lte("clock_in", weekEnd.toISOString());

    if (weekErr) console.error("Week summary error:", weekErr);

    const weeklyHours = weekRows?.reduce((sum, r) => sum + (r.hours_worked || 0), 0) || 0;
    const weeklyShifts = weekRows?.length || 0;

    // ─────────────────────────────
    // MONTH SUMMARY
    // ─────────────────────────────
    const { data: monthRows, error: monthErr } = await supabase
      .from("timesheets")
      .select("hours_worked, clock_in")
      .eq("staff_id", staffId)
      .gte("clock_in", monthStart.toISOString())
      .lte("clock_in", monthEnd.toISOString());

    if (monthErr) console.error("Month summary error:", monthErr);

    const monthlyHours = monthRows?.reduce((sum, r) => sum + (r.hours_worked || 0), 0) || 0;
    const monthlyShifts = monthRows?.length || 0;

    const avgShiftLength =
      monthlyShifts > 0 ? monthlyHours / monthlyShifts : 0;

    return NextResponse.json({
      staff_id: staffId,
      weekly: {
        hours: weeklyHours,
        shifts: weeklyShifts,
        week_start: weekStart,
        week_end: weekEnd,
      },
      monthly: {
        hours: monthlyHours,
        shifts: monthlyShifts,
        month_start: monthStart,
        month_end: monthEnd,
      },
      averages: {
        avg_shift_length: avgShiftLength,
      },
    });
  } catch (err) {
    console.error("Fatal summary error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
