// FILE: app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (sessionId) {
    await supabase.from("sessions").delete().eq("id", sessionId);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("session_id", "", { maxAge: 0, path: "/" });
  return res;
}
