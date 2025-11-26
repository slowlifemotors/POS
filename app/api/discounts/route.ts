// app/api/discounts/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side supabase client (service role)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// -----------------------------------------------------------------------------
// AUTH HELPER — owner/admin only (permissions_level >= 900)
// -----------------------------------------------------------------------------
async function requireOwnerOrAdmin(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionId =
    cookieHeader
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === "session_id")?.[1] || null;

  if (!sessionId)
    return { ok: false, status: 401, message: "Not authenticated" };

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select(
      `
      id,
      staff:staff_id (
        id,
        role_id
      )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRow?.staff)
    return { ok: false, status: 401, message: "Invalid session" };

  const staff = Array.isArray(sessionRow.staff)
    ? sessionRow.staff[0]
    : sessionRow.staff;

  const { data: role } = await supabase
    .from("roles")
    .select("permissions_level")
    .eq("id", staff.role_id)
    .single();

  if (!role || role.permissions_level < 900)
    return { ok: false, status: 403, message: "Forbidden" };

  return { ok: true };
}

// -----------------------------------------------------------------------------
// GET — All discounts or one by ?id
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const guard = await requireOwnerOrAdmin(req);
    if (!guard.ok)
      return NextResponse.json({ error: guard.message }, { status: guard.status });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabase
        .from("discounts")
        .select("id, name, percent")
        .eq("id", id)
        .maybeSingle();

      if (error || !data)
        return NextResponse.json({ discount: null }, { status: 404 });

      return NextResponse.json({ discount: data });
    }

    const { data } = await supabase
      .from("discounts")
      .select("id, name, percent")
      .order("name");

    return NextResponse.json({ discounts: data || [] });
  } catch (err) {
    console.error("GET discounts error:", err);
    return NextResponse.json({ discounts: [] });
  }
}

// -----------------------------------------------------------------------------
// POST — Create discount
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  const guard = await requireOwnerOrAdmin(req);
  if (!guard.ok)
    return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json();
  const name = String(body.name || "").trim();
  const percent = Number(body.percent);

  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("discounts")
    .insert([{ name, percent }])
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discount: data });
}

// -----------------------------------------------------------------------------
// PUT — Update discount
// -----------------------------------------------------------------------------
export async function PUT(req: Request) {
  const guard = await requireOwnerOrAdmin(req);
  if (!guard.ok)
    return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json();
  const id = body.id;

  if (!id)
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const updates = {
    name: String(body.name || "").trim(),
    percent: Number(body.percent),
  };

  const { data, error } = await supabase
    .from("discounts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discount: data });
}

// -----------------------------------------------------------------------------
// DELETE — Remove discount
// -----------------------------------------------------------------------------
export async function DELETE(req: Request) {
  const guard = await requireOwnerOrAdmin(req);
  if (!guard.ok)
    return NextResponse.json({ error: guard.message }, { status: guard.status });

  const { id } = await req.json();

  if (!id)
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const { error } = await supabase.from("discounts").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
