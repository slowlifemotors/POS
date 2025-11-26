// app/api/timesheet/top-hours/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
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

    // 1. Fetch raw timesheet rows for the month
    const { data: shifts, error: shiftErr } = await supabase
      .from("timesheets")
      .select("staff_id, hours_worked")
      .gte("clock_in", monthStart.toISOString())
      .lte("clock_in", monthEnd.toISOString());

    if (shiftErr) {
      console.error("Top hours error:", shiftErr);
      return NextResponse.json({ top: null, list: [] });
    }

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ top: null, list: [] });
    }

    // 2. Extract all involved staff IDs
    const staffIds = [...new Set(shifts.map((s) => s.staff_id))];

    // 3. Fetch staff records
    const { data: staffList, error: staffErr } = await supabase
      .from("staff")
      .select("id, name, role_id")
      .in("id", staffIds);

    if (staffErr) {
      console.error("Staff join error:", staffErr);
      return NextResponse.json({ top: null, list: [] });
    }

    // 4. Fetch roles
    const { data: roles, error: rolesErr } = await supabase
      .from("roles")
      .select("id, name");

    if (rolesErr) {
      console.error("Roles join error:", rolesErr);
      return NextResponse.json({ top: null, list: [] });
    }

    // 5. Sum hours per staff
    const totals: Record<
      number,
      { staff_id: number; staff_name: string; role: string; hours: number }
    > = {};

    for (const shift of shifts) {
      const sid = shift.staff_id;
      const hours = shift.hours_worked || 0;

      const staff = staffList?.find((s) => s.id === sid);
      const role = roles?.find((r) => r.id === staff?.role_id);

      if (!totals[sid]) {
        totals[sid] = {
          staff_id: sid,
          staff_name: staff?.name || "Unknown",
          role: role?.name || "Unknown",
          hours: 0,
        };
      }

      totals[sid].hours += hours;
    }

    // 6. Convert to sorted list
    const list = Object.values(totals).sort((a, b) => b.hours - a.hours);

    return NextResponse.json({
      month_start: monthStart,
      month_end: monthEnd,
      top: list[0] || null,
      list,
    });
  } catch (err) {
    console.error("Top hours fatal error:", err);
    return NextResponse.json({ top: null, list: [] });
  }
}
