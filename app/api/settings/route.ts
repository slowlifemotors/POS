// app/api/settings/route.ts

/**
 * ============================================================================
 *  SETTINGS API — Commission Rates + Hourly Pay Rates
 *
 *  Shape ALWAYS matches /lib/types.ts:
 *
 *    GET:
 *    {
 *      commission_rates: CommissionRate[],
 *      hourly_rates: { role: string; hourly_rate: number }[]
 *    }
 *
 *    PUT:
 *    {
 *      role: string,
 *      rate: number,
 *      hourly_rate: number
 *    }
 *
 *  Permission Rules:
 *    - Only owner/admin may edit
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import type { CommissionRate } from "@/lib/types";

// ---------------------------------------------------------
// SERVER SUPABASE CLIENT (SERVICE KEY)
// ---------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// Only Owner + Admin may edit settings
const EDIT_ROLES = ["owner", "admin"];

// ---------------------------------------------------------
// Validate session + role (Owner/Admin only for edits)
// ---------------------------------------------------------
async function requireAdmin() {
  const session = await getSession();

  if (!session?.staff) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  const role = session.staff.role?.toLowerCase();

  if (!EDIT_ROLES.includes(role)) {
    return { ok: false, status: 403, message: "Insufficient permissions" };
  }

  return { ok: true };
}

// ---------------------------------------------------------
// GET — RETURN ALL COMMISSION + HOURLY RATES
// Frontend expects:
// {
//   commission_rates: [ { role, rate } ],
//   hourly_rates:    [ { role, hourly_rate } ]
// }
// ---------------------------------------------------------
export async function GET() {
  // Fetch commission rates
  const { data: commissionData, error: cErr } = await supabase
    .from("commission_rates")
    .select("role, rate")
    .order("role");

  if (cErr) {
    console.error("Commission GET error:", cErr);
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const commission_rates: CommissionRate[] = commissionData.map((row) => ({
    role: row.role.toLowerCase(),
    rate: Number(row.rate),
  }));

  // Fetch hourly rates from roles table
  const { data: hourlyData, error: hErr } = await supabase
    .from("roles")
    .select("name, hourly_rate")
    .order("name");

  if (hErr) {
    console.error("Hourly GET error:", hErr);
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }

  const hourly_rates = hourlyData.map((row) => ({
    role: row.name.toLowerCase(),
    hourly_rate: Number(row.hourly_rate ?? 0),
  }));

  return NextResponse.json({
    commission_rates,
    hourly_rates,
  });
}

// ---------------------------------------------------------
// PUT — UPDATE COMMISSION + HOURLY RATE (Owner/Admin only)
//
// Body:
// {
//   role: string,
//   rate: number,
//   hourly_rate: number
// }
//
// ---------------------------------------------------------
export async function PUT(req: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.message },
      { status: guard.status }
    );
  }

  const { role, rate, hourly_rate } = await req.json();

  if (!role || rate === undefined || hourly_rate === undefined) {
    return NextResponse.json(
      { error: "Missing role, rate, or hourly_rate" },
      { status: 400 }
    );
  }

  const normalizedRole = role.toLowerCase();

  // ---------------------------------------------------------
  // UPDATE COMMISSION RATE
  // ---------------------------------------------------------
  const { error: cErr } = await supabase
    .from("commission_rates")
    .update({ rate })
    .eq("role", normalizedRole);

  if (cErr) {
    console.error("Commission PUT error:", cErr);
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  // ---------------------------------------------------------
  // UPDATE HOURLY PAY RATE IN ROLES TABLE
  // ---------------------------------------------------------
  const { error: hErr } = await supabase
    .from("roles")
    .update({ hourly_rate })
    .eq("name", normalizedRole);

  if (hErr) {
    console.error("Hourly PUT error:", hErr);
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }

  // Response shape matches lib/types.ts
  const commission_rate: CommissionRate = {
    role: normalizedRole,
    rate: Number(rate),
  };

  return NextResponse.json({ commission_rate });
}
