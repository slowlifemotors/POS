// app/api/roles/hourly/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// GET — list roles + hourly_rate
export async function GET() {
  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.staff.role.toLowerCase();
  const isAdmin = role === "admin" || role === "owner";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("permission_level");

  if (error) {
    console.error(error);
    return NextResponse.json({ roles: [] });
  }

  return NextResponse.json({ roles: data });
}

// PUT — update hourly_rate
export async function PUT(req: Request) {
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

  const { id, hourly_rate } = body;

  const { error } = await supabase
    .from("roles")
    .update({ hourly_rate })
    .eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
