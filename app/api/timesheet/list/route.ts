// app/api/timesheet/list/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json(
        { error: "Unauthorized", entries: [] },
        { status: 401 }
      );
    }

    const privileged = isManagerOrAbove(session.staff.role);

    const { searchParams } = new URL(req.url);
    const requestedStaffId = searchParams.get("staff_id");

    let targetStaffId: number;

    if (privileged && requestedStaffId) {
      targetStaffId = Number(requestedStaffId);
    } else {
      // Staff can only fetch their own timesheets
      targetStaffId = session.staff.id;
    }

    if (!targetStaffId) {
      return NextResponse.json({ entries: [] });
    }

    // JOIN with staff + roles for enriched data
    const { data, error } = await supabase
      .from("timesheets")
      .select(
        `
        id,
        staff_id,
        clock_in,
        clock_out,
        hours_worked,
        staff:staff_id (
          id,
          name,
          role:roles (
            name
          )
        )
      `
      )
      .eq("staff_id", targetStaffId)
      .order("clock_in", { ascending: false });

    if (error) {
      console.error("Timesheet list error:", error);
      return NextResponse.json({ entries: [] });
    }

    // Normalize response
    const entries = (data || []).map((row: any) => {
      return {
        id: row.id,
        staff_id: row.staff_id,
        staff_name: row.staff?.name || "",
        role: row.staff?.role?.name || "",
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        hours_worked: row.hours_worked || 0,
      };
    });

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Timesheet list fatal error:", err);
    return NextResponse.json({ entries: [] });
  }
}
