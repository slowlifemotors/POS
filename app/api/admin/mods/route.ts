// app/api/admin/mods/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type PricingType = "percentage" | "flat";

function isAdminOrOwner(role: unknown) {
  const r = typeof role === "string" ? role.toLowerCase().trim() : "";
  return r === "admin" || r === "owner";
}

async function requireAdminOrOwner(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  if (!session?.staff) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!isAdminOrOwner(session.staff.role)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

function parseUuid(val: any) {
  const s = typeof val === "string" ? val.trim() : "";
  return s || null;
}

function parsePricing(input: any, is_menu: boolean) {
  if (is_menu) {
    return { ok: true as const, pricing_type: null, pricing_value: null };
  }

  const pricing_type: PricingType | null =
    input?.pricing_type === "percentage" || input?.pricing_type === "flat"
      ? input.pricing_type
      : null;

  const pricing_value_raw = input?.pricing_value;

  if (pricing_type === null) {
    // allow "no pricing set yet"
    if (
      pricing_value_raw === null ||
      pricing_value_raw === undefined ||
      pricing_value_raw === ""
    ) {
      return { ok: true as const, pricing_type: null, pricing_value: null };
    }
    // pricing_value without pricing_type is invalid
    return {
      ok: false as const,
      error: "pricing_type is required when pricing_value is provided.",
    };
  }

  const pricing_value = Number(pricing_value_raw);

  if (!Number.isFinite(pricing_value) || pricing_value < 0) {
    return {
      ok: false as const,
      error: "pricing_value must be a valid number (>= 0).",
    };
  }

  if (pricing_type === "percentage" && pricing_value > 100) {
    return {
      ok: false as const,
      error: "percentage pricing_value must be <= 100.",
    };
  }

  return { ok: true as const, pricing_type, pricing_value };
}

export async function GET(req: Request) {
  const gate = await requireAdminOrOwner(req);
  if (!gate.ok) return gate.res;

  try {
    const { data, error } = await supabaseServer
      .from("mods")
      .select(
        "id, name, parent_id, display_order, is_menu, pricing_type, pricing_value, active, created_at, updated_at"
      )
      .order("parent_id", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/admin/mods error:", error);
      return NextResponse.json(
        {
          error: "Failed to load mods",
          details: {
            message: error.message,
            code: (error as any).code ?? null,
            hint: (error as any).hint ?? null,
            details: (error as any).details ?? null,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ mods: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/mods fatal:", err);
    return NextResponse.json(
      { error: "Server error loading mods" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminOrOwner(req);
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const parent_id = parseUuid(body?.parent_id);
    const display_order = Number.isFinite(Number(body?.display_order))
      ? Number(body.display_order)
      : 0;
    const is_menu = Boolean(body?.is_menu);
    const active = typeof body?.active === "boolean" ? body.active : true;

    if (display_order < 0) {
      return NextResponse.json({ error: "display_order must be >= 0" }, { status: 400 });
    }

    const pricing = parsePricing(body, is_menu);
    if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

    const { data, error } = await supabaseServer
      .from("mods")
      .insert({
        name,
        parent_id,
        display_order,
        is_menu,
        pricing_type: pricing.pricing_type,
        pricing_value: pricing.pricing_value,
        active,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/admin/mods error:", error);
      return NextResponse.json(
        {
          error: "Failed to create mod/menu",
          details: {
            message: error.message,
            code: (error as any).code ?? null,
            hint: (error as any).hint ?? null,
            details: (error as any).details ?? null,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ mod: data }, { status: 200 });
  } catch (err) {
    console.error("POST /api/admin/mods fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
