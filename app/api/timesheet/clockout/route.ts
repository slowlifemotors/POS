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
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    const staffId = session.staff.id;

    // Find the active (unclosed) shift
    const { data: activeShift, error: activeErr } = await supabase
      .from("timesheets")
      .select("*")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .maybeSingle();

    if (activeErr && activeErr.code !== "PGRST116") {
      console.error("Clockout check error:", activeErr);
    }

    if (!activeShift) {
      return NextResponse.json(
        { error: "Not clocked in" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("timesheets")
      .update({
        clock_out: now
      })
      .eq("id", activeShift.id);

    if (error) {
      console.error("Clock-out error:", error);
      return NextResponse.json(
        { error: "Clock-out failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: activeShift.id,
      clock_out: now
    });
  } catch (err) {
    console.error("Clockout fatal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
