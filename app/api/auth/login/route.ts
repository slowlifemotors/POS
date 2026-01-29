// FILE: app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    let { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    username = username.trim().toLowerCase();
    const supabase = supabaseServer();

    const { data: staff } = await supabase
      .from("staff")
      .select("id, username, password_hash, role_id, active")
      .eq("username", username)
      .maybeSingle();

    if (!staff || !staff.active) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const sessionId = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);

    await supabase.from("sessions").insert({
      id: sessionId,
      staff_id: staff.id,
      expires_at: expires.toISOString(),
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("session_id", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
