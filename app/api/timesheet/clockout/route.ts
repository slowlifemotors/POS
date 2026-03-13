// app/api/timesheet/clockout/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const staffId = session.staff.id;

    // Find the one active shift:
    // must be marked clocked in AND still have no clock_out
    const { data: activeShifts, error: activeErr } = await supabase
      .from("timesheets")
      .select("id, clock_in")
      .eq("staff_id", staffId)
      .eq("is_clocked_in", true)
      .is("clock_out", null)
      .limit(1);

    if (activeErr) {
      console.error("Clock-out check error:", activeErr);
      return NextResponse.json(
        { error: "Failed to check active shift" },
        { status: 500 }
      );
    }

    const activeShift = activeShifts?.[0];

    if (!activeShift) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const clockInTime = new Date(activeShift.clock_in).getTime();
    const clockOutTime = new Date(now).getTime();
    const hoursWorked = (clockOutTime - clockInTime) / 1000 / 60 / 60;

    const { error: updateErr } = await supabase
      .from("timesheets")
      .update({
        clock_out: now,
        hours_worked: hoursWorked,
        is_clocked_in: false,
      })
      .eq("id", activeShift.id)
      .eq("is_clocked_in", true)
      .is("clock_out", null);

    if (updateErr) {
      console.error("Clock-out update error:", updateErr);
      return NextResponse.json(
        { error: "Clock-out failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: activeShift.id,
      clock_in: activeShift.clock_in,
      clock_out: now,
      hours_worked: hoursWorked,
    });
  } catch (err) {
    console.error("Clock-out fatal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}