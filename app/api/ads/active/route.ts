// app/api/ads/active/route.ts
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

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("advertisements")
    .select("id, text, display_order")
    .eq("enabled", true)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ads = data ?? [];
  if (ads.length === 0) return NextResponse.json({ ad: null });

  // ✅ Rotate every 30 minutes (same ad for all clients in that window)
  const thirtyMinBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  const idx = thirtyMinBucket % ads.length;

  return NextResponse.json({ ad: ads[idx] });
}
