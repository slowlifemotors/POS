// app/api/timesheet/user-month-hours/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.staff.role.toLowerCase();
    const isPrivileged = ["admin", "owner", "manager"].includes(role);

    const { searchParams } = new URL(req.url);
    const staffId = Number(searchParams.get("staff_id"));

    if (!staffId) {
      return NextResponse.json({ error: "Missing staff_id" }, { status: 400 });
    }

    // Staff can only view themselves
    if (!isPrivileged && staffId !== session.staff.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { data: rows, error } = await supabase
      .from("timesheets")
      .select("hours_worked")
      .eq("staff_id", staffId)
      .gte("clock_in", monthStart.toISOString())
      .lte("clock_in", monthEnd.toISOString());

    if (error) {
      console.error("User month hours error:", error);
      return NextResponse.json({ user: null });
    }

    const totalHours =
      rows?.reduce((sum, r) => sum + (r.hours_worked || 0), 0) || 0;

    // Fetch staff name
    const { data: staff } = await supabase
      .from("staff")
      .select("id, name")
      .eq("id", staffId)
      .single();

    return NextResponse.json({
      user: {
        staff_id: staffId,
        name: staff?.name || "Unknown",
        hours: totalHours,
      },
    });
  } catch (err) {
    console.error("Fatal user-month-hours error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
