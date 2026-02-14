// app/api/ads/route.ts
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

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

async function requireManager(_req: Request) {
  // ✅ FIX: your getSession expects 0 args
  const session = await getSession();

  if (!session?.staff) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!isManagerOrAbove(session.staff.role)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, staff: session.staff };
}

/* ======================================================
   GET — list ads (optional ?enabled=true)
====================================================== */
export async function GET(req: Request) {
  const auth = await requireManager(req);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const enabledParam = searchParams.get("enabled");

  const supabase = getSupabaseAdmin();

  let q = supabase
    .from("advertisements")
    .select("id, text, enabled, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (enabledParam === "true") q = q.eq("enabled", true);
  if (enabledParam === "false") q = q.eq("enabled", false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ads: data ?? [] });
}

/* ======================================================
   POST — create ad
   body: { text, enabled?, display_order? }
====================================================== */
export async function POST(req: Request) {
  const auth = await requireManager(req);
  if (!auth.ok) return auth.res;

  const supabase = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });

  const enabled = body?.enabled == null ? true : Boolean(body.enabled);
  const display_order = Number.isFinite(Number(body?.display_order)) ? Number(body.display_order) : 0;

  const { data, error } = await supabase
    .from("advertisements")
    .insert([{ text, enabled, display_order }])
    .select("id, text, enabled, display_order, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ad: data });
}

/* ======================================================
   PUT — update ad
   body: { id, text?, enabled?, display_order? }
====================================================== */
export async function PUT(req: Request) {
  const auth = await requireManager(req);
  if (!auth.ok) return auth.res;

  const supabase = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Valid id is required." }, { status: 400 });
  }

  const patch: any = {};
  if (body?.text != null) {
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Text cannot be empty." }, { status: 400 });
    patch.text = text;
  }
  if (body?.enabled != null) patch.enabled = Boolean(body.enabled);
  if (body?.display_order != null) {
    const n = Number(body.display_order);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "display_order must be a number." }, { status: 400 });
    }
    patch.display_order = n;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("advertisements")
    .update(patch)
    .eq("id", id)
    .select("id, text, enabled, display_order, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ad: data });
}

/* ======================================================
   DELETE — delete ad
   body: { id }
====================================================== */
export async function DELETE(req: Request) {
  const auth = await requireManager(req);
  if (!auth.ok) return auth.res;

  const supabase = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Valid id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("advertisements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
