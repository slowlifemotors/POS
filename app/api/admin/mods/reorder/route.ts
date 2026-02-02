// app/api/admin/mods/reorder/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

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

type ReorderItem = { id: string; display_order: number };

export async function POST(req: Request) {
  const gate = await requireAdminOrOwner(req);
  if (!gate.ok) return gate.res;

  try {
    const body = await req.json();

    const parent_id =
      body?.parent_id === null || body?.parent_id === undefined
        ? null
        : typeof body.parent_id === "string"
          ? body.parent_id.trim() || null
          : null;

    const items = Array.isArray(body?.items) ? (body.items as ReorderItem[]) : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "items is required" }, { status: 400 });
    }

    // Basic validation
    for (const it of items) {
      const id = typeof it?.id === "string" ? it.id.trim() : "";
      const order = Number(it?.display_order);

      if (!id) return NextResponse.json({ error: "Each item must have an id" }, { status: 400 });
      if (!Number.isFinite(order) || order < 0) {
        return NextResponse.json({ error: "display_order must be a number >= 0" }, { status: 400 });
      }
    }

    // Ensure all belong to the provided parent_id (avoid cross-parent corruption)
    const ids = items.map((i) => i.id);

    const { data: existing, error: fetchErr } = await supabaseServer
      .from("mods")
      .select("id, parent_id")
      .in("id", ids);

    if (fetchErr) {
      console.error("POST /api/admin/mods/reorder fetch error:", fetchErr);
      return NextResponse.json({ error: "Failed to validate mods" }, { status: 500 });
    }

    const existingById = new Map<string, any>();
    (existing ?? []).forEach((r: any) => existingById.set(String(r.id), r));

    for (const it of items) {
      const row = existingById.get(it.id);
      if (!row) {
        return NextResponse.json({ error: `Mod not found: ${it.id}` }, { status: 400 });
      }

      const rowParent = row.parent_id ? String(row.parent_id) : null;
      if (rowParent !== parent_id) {
        return NextResponse.json(
          { error: "All items must share the same parent_id" },
          { status: 400 }
        );
      }
    }

    // Update one-by-one (simple + safe; fast enough for this tree size)
    for (const it of items) {
      const { error } = await supabaseServer
        .from("mods")
        .update({ display_order: it.display_order })
        .eq("id", it.id);

      if (error) {
        console.error("POST /api/admin/mods/reorder update error:", error);
        return NextResponse.json({ error: "Failed to reorder mods" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/admin/mods/reorder fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
