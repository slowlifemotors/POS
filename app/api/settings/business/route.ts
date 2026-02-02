// app/api/settings/business/route.ts
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

function canManageBusinessSettings(role: unknown) {
  const r = typeof role === "string" ? role.toLowerCase().trim() : "";
  return r === "admin" || r === "owner" || r === "manager";
}

function injectCookieHeader(req: Request) {
  // Keep consistent with the rest of your API routes that call getSession()
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;
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
    // Not strictly required for GET (no session check),
    // but consistent + helps if you later add auth here.
    injectCookieHeader(req);

    const data = await ensureBusinessRowExists();
    return NextResponse.json({ settings: data });
  } catch (error: any) {
    console.error("GET business settings error:", error);
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

    // ✅ Match UI permission rule: Admin/Owner/Manager
    if (!canManageBusinessSettings(session.staff.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const {
      business_name,
      business_logo_url,
      theme_color,
      logo_width,
      logo_height,

      background_image_url,
      background_opacity,
      background_darken_enabled,
      background_darken_strength,
    } = body ?? {};

    const supabase = getSupabaseAdmin();
    await ensureBusinessRowExists();

    const { data, error } = await supabase
      .from("business_settings")
      .update({
        business_name: business_name ?? null,
        business_logo_url: business_logo_url ?? null,
        theme_color: theme_color ?? null,
        logo_width: logo_width ?? null,
        logo_height: logo_height ?? null,

        background_image_url: background_image_url ?? null,
        background_opacity:
          typeof background_opacity === "number"
            ? background_opacity
            : background_opacity
            ? Number(background_opacity)
            : null,

        background_darken_enabled:
          typeof background_darken_enabled === "boolean"
            ? background_darken_enabled
            : null,

        background_darken_strength:
          typeof background_darken_strength === "number"
            ? background_darken_strength
            : background_darken_strength
            ? Number(background_darken_strength)
            : null,
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      console.error("PUT business settings error:", error);
      return NextResponse.json(
        { error: "Failed to update business settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (error: any) {
    console.error("PUT business settings unexpected error:", error);
    return NextResponse.json({ error: "Failed to update business settings" }, { status: 500 });
  }
}
