// app/api/timesheet/top-month-hours/route.ts
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.staff.role.toLowerCase();
    const isPrivileged = ["admin", "owner", "manager"].includes(role);

    if (!isPrivileged) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Fetch all hours for all staff in date range
    const { data: times, error } = await supabase
      .from("timesheets")
      .select("staff_id, hours_worked")
      .gte("clock_in", monthStart.toISOString())
      .lte("clock_in", monthEnd.toISOString());

    if (error) {
      console.error("Timesheet aggregation error:", error);
      return NextResponse.json({ top: null });
    }

    if (!times || times.length === 0) {
      return NextResponse.json({ top: null });
    }

    // Aggregate hours by staff ID
    const hoursMap: Record<number, number> = {};

    for (const t of times) {
      if (!t.staff_id) continue;

      const hrs = Number(t.hours_worked || 0);
      hoursMap[t.staff_id] = (hoursMap[t.staff_id] || 0) + hrs;
    }

    // Determine top staff
    let topStaffId: number | null = null;
    let topHours = 0;

    for (const id in hoursMap) {
      const hrs = hoursMap[id];
      if (hrs > topHours) {
        topHours = hrs;
        topStaffId = Number(id);
      }
    }

    if (!topStaffId) {
      return NextResponse.json({ top: null });
    }

    // Fetch staff name
    const { data: staff } = await supabase
      .from("staff")
      .select("id, name")
      .eq("id", topStaffId)
      .single();

    return NextResponse.json({
      top: {
        staff_id: topStaffId,
        name: staff?.name || "Unknown",
        hours: topHours,
      },
    });
  } catch (err) {
    console.error("Fatal top-month-hours error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
