// app/api/tabs/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// --- AUTH HELPER ----------------------------------------------------
async function requireManagerRole(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionId =
    cookieHeader
      .split(";")
      .map((x) => x.trim().split("="))
      .find(([k]) => k === "session_id")?.[1] || null;

  if (!sessionId) return null;

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select(`id, staff:staff_id ( id, role_id )`)
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRow?.staff) return null;

  const staff = Array.isArray(sessionRow.staff)
    ? sessionRow.staff[0]
    : sessionRow.staff;

  const { data: role } = await supabase
    .from("roles")
    .select("permissions_level")
    .eq("id", staff.role_id)
    .maybeSingle();

  return role?.permissions_level >= 800;
}

// --- GET ALL TABS ----------------------------------------------------
export async function GET() {
  const { data, error } = await supabase
    .from("tabs")
    .select("id, name, amount, active, created_at")
    .order("created_at");

  if (error) return NextResponse.json({ tabs: [] });

  return NextResponse.json({ tabs: data });
}

// --- CREATE TAB ------------------------------------------------------
export async function POST(req: Request) {
  const allowed = await requireManagerRole(req);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const { data, error } = await supabase
    .from("tabs")
    .insert({
      name: body.name,
      amount: body.amount,
      active: true,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tab: data });
}

// --- UPDATE TAB ------------------------------------------------------
export async function PUT(req: Request) {
  const allowed = await requireManagerRole(req);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const { data, error } = await supabase
    .from("tabs")
    .update({
      name: body.name,
      amount: body.amount,
      active: body.active,
    })
    .eq("id", body.id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tab: data });
}

// --- DELETE TAB ------------------------------------------------------
export async function DELETE(req: Request) {
  const allowed = await requireManagerRole(req);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const { error } = await supabase.from("tabs").delete().eq("id", Number(id));

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
