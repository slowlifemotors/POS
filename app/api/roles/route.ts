// app/api/roles/route.ts

/**
 * ============================================================================
 *  ROLES API — Returns roles the caller is allowed to assign
 *
 *  FINAL RULES:
 *    ADMIN:
 *      - Can assign ANY role
 *    OWNER:
 *      - Can assign ANY role EXCEPT admin
 *    ALL OTHERS:
 *      - Cannot assign roles at all
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import type { RoleRecord } from "@/lib/types";

function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const caller = session.staff;
    const callerRole = caller.role.toLowerCase();
    const callerLevel = caller.permissions_level;

    // ------------------------------------------------------------
    // Load all roles from database
    // ------------------------------------------------------------
    const supabase = supabaseServer();

    const { data: roles, error: rolesErr } = await supabase
      .from("roles")
      .select("id, name, permissions_level, commission_rate")
      .order("permissions_level", { ascending: false });

    if (rolesErr || !roles) {
      console.error("Roles load error:", rolesErr);
      return NextResponse.json(
        { error: "Failed to load roles" },
        { status: 500 }
      );
    }

    const allRoles: RoleRecord[] = roles.map((r) => ({
      id: r.id,
      name: (r.name || "").toLowerCase(),
      permissions_level: Number(r.permissions_level ?? 0),
      commission_rate: Number(r.commission_rate ?? 0),
    }));

    // ------------------------------------------------------------
    // APPLY FINAL ASSIGN-PERMISSION RULES
    // ------------------------------------------------------------

    // ADMIN → can assign ANY role
    if (callerRole === "admin") {
      return NextResponse.json({ roles: allRoles });
    }

    // OWNER → can assign ANY role EXCEPT admin
    if (callerRole === "owner") {
      const filtered = allRoles.filter((r) => r.name !== "admin");
      return NextResponse.json({ roles: filtered });
    }

    // ALL OTHER ROLES → cannot assign anything
    return NextResponse.json({ roles: [] });

  } catch (err) {
    console.error("Roles API error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
