// app/api/hourly/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// ─────────────────────────────────────────────
// GET — Return all roles + hourly_rate (admin & owner only)
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    const staff = session?.staff ?? null;

    if (!staff || (staff.role !== "admin" && staff.role !== "owner")) {
      return NextResponse.json({ error: "Forbidden", roles: [] }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("roles")
      .select("id, name, hourly_rate")
      .order("permissions_level", { ascending: false });

    if (error) {
      console.error("Hourly GET error:", error);
      return NextResponse.json({ roles: [] });
    }

    return NextResponse.json({ roles: data });
  } catch (err) {
    console.error("Hourly GET fatal error:", err);
    return NextResponse.json({ roles: [] });
  }
}

// ─────────────────────────────────────────────
// PUT — Update hourly_rate (admin & owner only)
// Incoming JSON format:
// { id: number, hourly_rate: number }
// ─────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    const staff = session?.staff ?? null;

    if (!staff || (staff.role !== "admin" && staff.role !== "owner")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, hourly_rate } = body;

    if (!id || typeof hourly_rate !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("roles")
      .update({ hourly_rate })
      .eq("id", id)
      .select("id, name, hourly_rate")
      .single();

    if (error) {
      console.error("Hourly PUT error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      role: data
    });
  } catch (err) {
    console.error("Hourly PUT fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
