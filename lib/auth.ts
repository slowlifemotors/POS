// lib/auth.ts

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { StaffRecord, Session } from "./types";

/* -------------------------------------------------------------
 * Extend globalThis (Fix TS errors)
 * ------------------------------------------------------------- */
declare global {
  // eslint-disable-next-line no-var
  var __session_cookie_header: string | undefined;
}

/* -------------------------------------------------------------
 * SERVER SUPABASE CLIENT
 * ------------------------------------------------------------- */
function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* -------------------------------------------------------------
 * normalizeStaffRow
 * ------------------------------------------------------------- */
function normalizeStaffRow(row: any): StaffRecord {
  return {
    id: row.id,
    name: row.name,
    username: row.username,

    role_id: row.role_id,
    role: row.roles?.name?.toLowerCase().trim() || "staff",

    permissions_level: Number(row.roles?.permissions_level ?? 0),
    commission_rate: Number(row.roles?.commission_rate ?? 0),
  };
}

/* -------------------------------------------------------------
 * getSession
 * ------------------------------------------------------------- */
export async function getSession(): Promise<Session> {
  try {
    // -----------------------------------------
    // 1. Read cookies correctly in Next.js 15
    // -----------------------------------------
    const cookieStore = await cookies();
    const cookieHeader =
      globalThis.__session_cookie_header ??
      cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

    // Parse session_id manually
    const sessionId = cookieHeader
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === "session_id")?.[1];

    if (!sessionId) return { staff: null };

    // -----------------------------------------
    // 2. Lookup session in Supabase
    // -----------------------------------------
    const supabase = supabaseServer();

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, staff_id, expires_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionErr || !sessionRow) return { staff: null };

    if (new Date(sessionRow.expires_at) < new Date()) {
      return { staff: null };
    }

    // -----------------------------------------
    // 3. Fetch staff + role
    // -----------------------------------------
    const { data: staffRow, error: staffErr } = await supabase
      .from("staff")
      .select(
        `
        id,
        name,
        username,
        role_id,
        roles:role_id (
          name,
          permissions_level,
          commission_rate
        )
      `
      )
      .eq("id", sessionRow.staff_id)
      .maybeSingle();

    if (staffErr || !staffRow) return { staff: null };

    return { staff: normalizeStaffRow(staffRow) };
  } catch (err) {
    console.error("SESSION ERROR:", err);
    return { staff: null };
  }
}
