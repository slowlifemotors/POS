// app/api/live/clockoff/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function calculateHours(clock_in: string | null, clock_out: string | null): number | null {
  if (!clock_in || !clock_out) return null;

  const start = new Date(clock_in).getTime();
  const end = new Date(clock_out).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;

  return (end - start) / 1000 / 60 / 60;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.staff.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "owner";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { timesheet_id } = body;

    if (!timesheet_id) {
      return NextResponse.json({ error: "Missing timesheet_id" }, { status: 400 });
    }

    // Load the row so we can compute hours safely
    const { data: row, error: fetchErr } = await supabase
      .from("timesheets")
      .select("id, clock_in, clock_out, is_clocked_in")
      .eq("id", timesheet_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("Clockoff fetch error:", fetchErr);
      return NextResponse.json({ error: "Failed to fetch timesheet" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    // If already clocked out, do nothing
    if (row.clock_out) {
      return NextResponse.json({ success: true, already_clocked_out: true });
    }

    const now = new Date().toISOString();
    const hours_worked = calculateHours(row.clock_in, now);

    const { error: updateErr } = await supabase
      .from("timesheets")
      .update({
        clock_out: now,
        hours_worked,
        is_clocked_in: false,
      })
      .eq("id", timesheet_id);

    if (updateErr) {
      console.error("Clockoff update error:", updateErr);
      return NextResponse.json({ error: "Clock-off failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: timesheet_id,
      clock_out: now,
      hours_worked,
    });
  } catch (err) {
    console.error("Clockoff fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
