// app/api/settings/discount-policy/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isAdminOrOwner(role: unknown) {
  const r = roleLower(role);
  return r === "admin" || r === "owner";
}

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

async function requireSession(req: Request) {
  // IMPORTANT: matches the pattern used elsewhere in your app
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  return session?.staff ? session : null;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("business_settings")
      .select("staff_discount_always_on, staff_discount_min_monthly_hours")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("GET /api/settings/discount-policy error:", error);
      return NextResponse.json(
        { staff_discount_always_on: false, staff_discount_min_monthly_hours: 0 },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        staff_discount_always_on: Boolean(data?.staff_discount_always_on),
        staff_discount_min_monthly_hours: Number(
          data?.staff_discount_min_monthly_hours ?? 0
        ),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/settings/discount-policy fatal:", err);
    return NextResponse.json(
      { staff_discount_always_on: false, staff_discount_min_monthly_hours: 0 },
      { status: 200 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession(req);
    if (!session?.staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminOrOwner(session.staff.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const staff_discount_always_on = Boolean(body?.staff_discount_always_on);

    // clamp to 0..500
    const minRaw = toInt(body?.staff_discount_min_monthly_hours, 0);
    const staff_discount_min_monthly_hours = Math.max(0, Math.min(500, minRaw));

    const { data: firstRow, error: firstErr } = await supabase
      .from("business_settings")
      .select("id")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    if (firstErr || !firstRow) {
      console.error("business_settings missing:", firstErr);
      return NextResponse.json(
        { error: "business_settings row not found" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("business_settings")
      .update({
        staff_discount_always_on,
        staff_discount_min_monthly_hours,
      })
      .eq("id", firstRow.id)
      .select("staff_discount_always_on, staff_discount_min_monthly_hours")
      .single();

    if (error) {
      console.error("PUT /api/settings/discount-policy error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json(
      {
        staff_discount_always_on: Boolean(data?.staff_discount_always_on),
        staff_discount_min_monthly_hours: Number(
          data?.staff_discount_min_monthly_hours ?? 0
        ),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("PUT /api/settings/discount-policy fatal:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
