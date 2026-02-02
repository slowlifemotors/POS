// app/api/admin/mods/[id]/route.ts
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
    if (
      pricing_value_raw === null ||
      pricing_value_raw === undefined ||
      pricing_value_raw === ""
    ) {
      return { ok: true as const, pricing_type: null, pricing_value: null };
    }
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminOrOwner(req);
  if (!gate.ok) return gate.res;

  const params = await ctx.params;
  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();

    const { data: existing, error: fetchErr } = await supabaseServer
      .from("mods")
      .select("id, is_menu")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      console.error("PATCH /api/admin/mods/[id] fetch error:", fetchErr);
      return NextResponse.json(
        {
          error: "Failed to load mod",
          details: {
            message: fetchErr.message,
            code: (fetchErr as any).code ?? null,
            hint: (fetchErr as any).hint ?? null,
            details: (fetchErr as any).details ?? null,
          },
        },
        { status: 500 }
      );
    }
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const name = typeof body?.name === "string" ? body.name.trim() : undefined;

    const parent_id =
      body?.parent_id !== undefined ? parseUuid(body.parent_id) : undefined;

    const display_order =
      body?.display_order !== undefined && Number.isFinite(Number(body.display_order))
        ? Number(body.display_order)
        : undefined;

    const is_menu = body?.is_menu !== undefined ? Boolean(body.is_menu) : undefined;

    const active =
      body?.active !== undefined && typeof body.active === "boolean" ? body.active : undefined;

    const finalIsMenu = is_menu !== undefined ? is_menu : Boolean(existing.is_menu);

    if (display_order !== undefined && display_order < 0) {
      return NextResponse.json({ error: "display_order must be >= 0" }, { status: 400 });
    }

    const pricing = parsePricing(body, finalIsMenu);
    if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

    const update: any = {};

    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      update.name = name;
    }
    if (parent_id !== undefined) update.parent_id = parent_id;
    if (display_order !== undefined) update.display_order = display_order;
    if (is_menu !== undefined) update.is_menu = is_menu;
    if (active !== undefined) update.active = active;

    update.pricing_type = pricing.pricing_type;
    update.pricing_value = pricing.pricing_value;

    const { data, error } = await supabaseServer
      .from("mods")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("PATCH /api/admin/mods/[id] error:", error);
      return NextResponse.json(
        {
          error: "Failed to update mod/menu",
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
    console.error("PATCH /api/admin/mods/[id] fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminOrOwner(req);
  if (!gate.ok) return gate.res;

  const params = await ctx.params;
  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { error } = await supabaseServer.from("mods").delete().eq("id", id);

    if (error) {
      console.error("DELETE /api/admin/mods/[id] error:", error);
      return NextResponse.json(
        {
          error: "Failed to delete mod/menu",
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

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/admin/mods/[id] fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
