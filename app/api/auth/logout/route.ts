// app/api/auth/logout/route.ts

/**
 * ============================================================================
 *  LOGOUT ROUTE — Completely clears the user's session
 * ============================================================================
 *  Behavior:
 *    ✓ Deletes the session row from Supabase (if it exists)
 *    ✓ Clears the httpOnly `session_id` cookie
 *    ✓ Returns { success: true }
 *
 *  This route must remain in sync with /lib/auth.ts
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// SERVER SUPABASE CLIENT — Full access
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    // -----------------------------------------------------------------------
    // 1. Delete session from Supabase (if exists)
    // -----------------------------------------------------------------------
    if (sessionId) {
      const { error } = await supabase
        .from("sessions")      // ← your existing session table
        .delete()
        .eq("id", sessionId);  // ← PK is "id"

      if (error) {
        console.error("Session delete error:", error);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Clear the cookie
    // -----------------------------------------------------------------------
    const res = NextResponse.json({ success: true });

    res.cookies.set("session_id", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,           // immediately remove
    });

    return res;
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
