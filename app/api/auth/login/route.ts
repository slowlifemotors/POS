// app/api/auth/login/route.ts

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
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    // 🔥 normalize username exactly once
    username = username.trim().toLowerCase();

    const supabase = supabaseServer();

    // 🔥 match stored usernames in lowercase
    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .select("id, username, password_hash, role_id, active")
      .eq("username", username)
      .maybeSingle();

    if (staffErr || !staff) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (!staff.active) {
      return NextResponse.json(
        { error: "Account disabled" },
        { status: 403 }
      );
    }

    // 🔥 Ensure password_hash is valid
    if (!staff.password_hash || typeof staff.password_hash !== "string") {
      console.error("Invalid password_hash in DB for staff:", staff.id);
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // 🔥 bcrypt compare
    const valid = await bcrypt.compare(password, staff.password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create session
    const sessionId = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 12); // 12 hours

    const { error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        staff_id: staff.id,
        expires_at: expires.toISOString(),
      });

    if (sessionErr) {
      console.error("SESSION CREATE ERROR:", sessionErr);
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }

    const res = NextResponse.json({ success: true });

    // Set cookie
    res.cookies.set("session_id", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires,
    });

    return res;
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
