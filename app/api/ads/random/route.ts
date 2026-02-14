// app/api/ads/random/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * PUBLIC endpoint used by POS staff:
 * - returns a random enabled ad
 * - no auth required
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("advertisements")
    .select("id, text, display_order")
    .eq("enabled", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ads = data ?? [];
  if (ads.length === 0) return NextResponse.json({ ad: null });

  const idx = Math.floor(Math.random() * ads.length);
  return NextResponse.json({ ad: ads[idx] });
}
