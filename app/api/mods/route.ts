// app/api/mods/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function normalizeKey(input: unknown) {
  const raw = typeof input === "string" ? input.trim() : "";
  return raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function isAdminOrOwner(role: unknown) {
  const r = typeof role === "string" ? role.toLowerCase() : "";
  return r === "admin" || r === "owner";
}

async function requireAdminOrOwner() {
  const session = await getSession();
  if (!session?.staff)
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };

  if (!isAdminOrOwner(session.staff.role))
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };

  return { ok: true as const, session };
}

function parsePricing(body: any) {
  const pricing_type =
    body?.pricing_type === "flat" || body?.pricing_type === "percent"
      ? body.pricing_type
      : "percent";

  const percent = Number(body?.percent ?? 0);
  const flat_price =
    body?.flat_price === null || body?.flat_price === undefined || body?.flat_price === ""
      ? null
      : Number(body.flat_price);

  if (pricing_type === "percent") {
    if (!Number.isFinite(percent) || percent < 0) {
      return { ok: false as const, error: "Percent must be a valid number (>= 0)." };
    }
    return { ok: true as const, pricing_type, percent, flat_price: null as number | null };
  }

  // flat
  if (flat_price === null || !Number.isFinite(flat_price) || flat_price < 0) {
    return { ok: false as const, error: "Flat price must be a valid number (>= 0)." };
  }

  // percent can remain stored but isn't used when flat; keep it as 0 to avoid confusion
  return { ok: true as const, pricing_type, percent: 0, flat_price };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("vehicle_mods")
      .select(
        "id, key, label, pricing_type, percent, flat_price, section, sort_order, active, created_at, updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("GET /api/mods error:", error);
      return NextResponse.json({ mods: [] }, { status: 200 });
    }

    return NextResponse.json({ mods: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/mods fatal:", err);
    return NextResponse.json({ mods: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminOrOwner();
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json();

    const key = normalizeKey(body.key);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const section =
      typeof body.section === "string" && body.section.trim() ? body.section.trim() : null;
    const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    const active = typeof body.active === "boolean" ? body.active : true;

    if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });
    if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

    const pricing = parsePricing(body);
    if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("vehicle_mods")
      .insert({
        key,
        label,
        pricing_type: pricing.pricing_type,
        percent: pricing.percent,
        flat_price: pricing.flat_price,
        section,
        sort_order,
        active,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/mods error:", error);
      return NextResponse.json({ error: "Failed to create mod" }, { status: 500 });
    }

    return NextResponse.json({ mod: data }, { status: 200 });
  } catch (err) {
    console.error("POST /api/mods fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const gate = await requireAdminOrOwner();
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json();

    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const key = normalizeKey(body.key);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const section =
      typeof body.section === "string" && body.section.trim() ? body.section.trim() : null;
    const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    const active = typeof body.active === "boolean" ? body.active : true;

    if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });
    if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

    const pricing = parsePricing(body);
    if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("vehicle_mods")
      .update({
        key,
        label,
        pricing_type: pricing.pricing_type,
        percent: pricing.percent,
        flat_price: pricing.flat_price,
        section,
        sort_order,
        active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("PUT /api/mods error:", error);
      return NextResponse.json({ error: "Failed to update mod" }, { status: 500 });
    }

    return NextResponse.json({ mod: data }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/mods fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireAdminOrOwner();
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("vehicle_mods").delete().eq("id", id);

    if (error) {
      console.error("DELETE /api/mods error:", error);
      return NextResponse.json({ error: "Failed to delete mod" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/mods fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
