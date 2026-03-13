// app/api/timesheet/clockin/route.ts
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

    // Active shift = explicitly clocked in AND no clock_out yet
    const { data: activeShifts, error: checkErr } = await supabase
      .from("timesheets")
      .select("id")
      .eq("staff_id", staffId)
      .eq("is_clocked_in", true)
      .is("clock_out", null)
      .limit(1);

    if (checkErr) {
      console.error("Clock-in check error:", checkErr);
      return NextResponse.json(
        { error: "Failed to check clock-in status" },
        { status: 500 }
      );
    }

    if (activeShifts && activeShifts.length > 0) {
      return NextResponse.json(
        { error: "Already clocked in" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { error: insertErr } = await supabase.from("timesheets").insert({
      staff_id: staffId,
      clock_in: now,
      clock_out: null,
      hours_worked: null,
      is_clocked_in: true,
    });

    if (insertErr) {
      console.error("Clock-in insert error:", insertErr);

      // If unique index exists, this catches race conditions / double clicks
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: "Already clocked in" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Clock-in failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, clock_in: now });
  } catch (err) {
    console.error("Clock-in fatal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}