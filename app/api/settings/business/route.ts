// app/api/settings/business/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function injectCookieHeader(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;
}

function canManageBusinessSettings(role: unknown) {
  const r = typeof role === "string" ? role.toLowerCase().trim() : "";
  return r === "admin" || r === "owner" || r === "manager";
}

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function ensureBusinessRowExists() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await supabase
    .from("business_settings")
    .insert({ id: 1 })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return inserted;
}

export async function GET(req: Request) {
  try {
    injectCookieHeader(req);
    const data = await ensureBusinessRowExists();
    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("GET business settings error:", err);
    return NextResponse.json({ error: "Failed to load business settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    injectCookieHeader(req);

    const session = await getSession();
    if (!session?.staff) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!canManageBusinessSettings(session.staff.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const update: Record<string, any> = {};

    // ---- safe partial updates only ----

    if ("business_name" in body) update.business_name = body.business_name;
    if ("business_logo_url" in body) update.business_logo_url = body.business_logo_url;
    if ("theme_color" in body) update.theme_color = body.theme_color;

    if ("logo_width" in body) update.logo_width = Number(body.logo_width);
    if ("logo_height" in body) update.logo_height = Number(body.logo_height);

    if ("background_image_url" in body)
      update.background_image_url = body.background_image_url;

    if ("background_opacity" in body)
      update.background_opacity = Math.min(Math.max(Number(body.background_opacity), 0), 1);

    if ("background_darken_enabled" in body)
      update.background_darken_enabled = Boolean(body.background_darken_enabled);

    if ("background_darken_strength" in body)
      update.background_darken_strength = Math.min(
        Math.max(Number(body.background_darken_strength), 0),
        1
      );

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await ensureBusinessRowExists();

    const { data, error } = await supabase
      .from("business_settings")
      .update(update)
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      console.error("PUT business settings error:", error, update);
      return NextResponse.json(
        { error: "Failed to update business settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("PUT business settings fatal:", err);
    return NextResponse.json({ error: "Failed to update business settings" }, { status: 500 });
  }
}
