// app/api/timesheet/status/route.ts
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
      return NextResponse.json(
        { error: "Not logged in", clocked_in: false, active_entry: null },
        { status: 401 }
      );
    }

    const staffId = session.staff.id;

    // Use maybeSingle() to avoid throwing errors on empty results
    const { data: activeShift, error } = await supabase
      .from("timesheets")
      .select("*")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Status check error:", error);
    }

    return NextResponse.json({
      clocked_in: !!activeShift,
      active_entry: activeShift || null
    });
  } catch (err) {
    console.error("Timesheet status fatal error:", err);
    return NextResponse.json({
      clocked_in: false,
      active_entry: null
    });
  }
}
