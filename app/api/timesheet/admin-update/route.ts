// app/api/timesheet/admin-update/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// Utility — recompute hours from timestamps
function calculateHours(clock_in: string | null, clock_out: string | null): number | null {
  if (!clock_in || !clock_out) return null;

  const start = new Date(clock_in).getTime();
  const end = new Date(clock_out).getTime();

  if (isNaN(start) || isNaN(end) || end < start) return null;

  const diffMs = end - start;
  return diffMs / 1000 / 60 / 60; // convert ms → hours
}

// ─────────────────────────────────────────────
// PUT — Admin edit clock_in / clock_out
// ─────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.staff.role.toLowerCase();
    const isAdmin = role === "admin" || role === "owner";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, clock_in, clock_out } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const hours_worked = calculateHours(clock_in, clock_out);

    const { error } = await supabase
      .from("timesheets")
      .update({
        clock_in: clock_in || null,
        clock_out: clock_out || null,
        hours_worked: hours_worked,
      })
      .eq("id", id);

    if (error) {
      console.error("Admin update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: {
        id,
        clock_in,
        clock_out,
        hours_worked,
      }
    });
  } catch (err) {
    console.error("Admin update fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE — Admin delete entry
// ─────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.staff.role.toLowerCase();
    const isAdmin = role === "admin" || role === "owner";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("timesheets")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_id: id
    });
  } catch (err) {
    console.error("Delete fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
