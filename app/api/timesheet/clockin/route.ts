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

    // Check for an open (active) shift
    const { data: activeShift, error: activeErr } = await supabase
      .from("timesheets")
      .select("*")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .maybeSingle();

    if (activeErr && activeErr.code !== "PGRST116") {
      console.error("Clockin check error:", activeErr);
    }

    if (activeShift) {
      return NextResponse.json(
        { error: "Already clocked in" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("timesheets")
      .insert({
        staff_id: staffId,
        clock_in: now
      });

    if (error) {
      console.error("Clock-in error:", error);
      return NextResponse.json(
        { error: "Clock-in failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, clock_in: now });
  } catch (err) {
    console.error("Clockin fatal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
