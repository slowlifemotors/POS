// app/api/settings/commission/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isAdminOrOwner(role: unknown) {
  const r = roleLower(role);
  return r === "admin" || r === "owner";
}

/**
 * GET /api/settings/commission
 * Returns all roles with commission_rate + hourly_rate
 * Manager+ can view (same as your settings page intention)
 */
export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // allow manager/admin/owner to view
  const r = roleLower(session.staff.role);
  const isManagerOrAbove = r === "manager" || r === "admin" || r === "owner";
  if (!isManagerOrAbove) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("roles")
    .select("id, name, commission_rate, hourly_rate")
    .order("permissions_level", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("GET /api/settings/commission error:", error);
    return NextResponse.json({ roles: [] }, { status: 200 });
  }

  const roles = (data ?? []).map((x: any) => ({
    id: Number(x.id),
    role: String(x.name ?? "").toLowerCase(),
    rate: Number(x.commission_rate ?? 0),
    hourly_rate: Number(x.hourly_rate ?? 0),
  }));

  return NextResponse.json({ roles }, { status: 200 });
}

/**
 * PUT /api/settings/commission
 * Body: { role: string, rate: number, hourly_rate: number }
 * Only admin/owner can edit.
 */
export async function PUT(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdminOrOwner(session.staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const role = typeof body?.role === "string" ? body.role.trim() : "";
  const rate = Number(body?.rate);
  const hourly_rate = Number(body?.hourly_rate);

  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return NextResponse.json(
      { error: "rate must be a number between 0 and 100" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
    return NextResponse.json(
      { error: "hourly_rate must be a number >= 0" },
      { status: 400 }
    );
  }

  // Update the role by name (case-insensitive)
  const { data: roleRow, error: findErr } = await supabaseServer
    .from("roles")
    .select("id, name")
    .ilike("name", role)
    .maybeSingle();

  if (findErr) {
    console.error("PUT /api/settings/commission find error:", findErr);
    return NextResponse.json({ error: "Failed to find role" }, { status: 500 });
  }

  if (!roleRow) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("roles")
    .update({
      commission_rate: rate,
      hourly_rate,
    })
    .eq("id", roleRow.id)
    .select("id, name, commission_rate, hourly_rate")
    .single();

  if (error) {
    console.error("PUT /api/settings/commission update error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      role: {
        id: Number(data.id),
        role: String(data.name ?? "").toLowerCase(),
        rate: Number(data.commission_rate ?? 0),
        hourly_rate: Number(data.hourly_rate ?? 0),
      },
    },
    { status: 200 }
  );
}
