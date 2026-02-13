// app/api/raffle/log/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

function isOwnerOrAdmin(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin";
}

function asYMD(s: unknown) {
  if (typeof s !== "string") return null;
  const v = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function startOfDayISO(ymd: string) {
  return `${ymd}T00:00:00.000Z`;
}

function endOfDayISO(ymd: string) {
  return `${ymd}T23:59:59.999Z`;
}

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.staff) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session.staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const start = asYMD(url.searchParams.get("start"));
    const end = asYMD(url.searchParams.get("end"));

    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 25)));
    const offset = (page - 1) * limit;

    if (!start || !end) {
      return NextResponse.json({ error: "start and end (YYYY-MM-DD) are required" }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: "start must be <= end" }, { status: 400 });
    }

    // Count total in range (including deleted for audit visibility in admin list)
    const { count, error: countErr } = await supabaseServer
      .from("raffle_sales_log")
      .select("id", { count: "exact", head: true })
      .gte("sold_at", startOfDayISO(start))
      .lte("sold_at", endOfDayISO(end));

    if (countErr) {
      console.error("raffle log count error:", countErr);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const { data, error } = await supabaseServer
      .from("raffle_sales_log")
      .select("id, sold_at, customer_name, tickets, order_id, staff_id, deleted_at")
      .gte("sold_at", startOfDayISO(start))
      .lte("sold_at", endOfDayISO(end))
      .order("sold_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("raffle log list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rowsRaw = Array.isArray(data) ? (data as any[]) : [];
    const staffIds = Array.from(
      new Set(rowsRaw.map((r) => Number(r?.staff_id ?? 0)).filter((n) => Number.isFinite(n) && n > 0))
    );

    let staffNameById = new Map<number, string>();
    if (staffIds.length > 0) {
      const { data: staffRows, error: staffErr } = await supabaseServer
        .from("staff")
        .select("id, name")
        .in("id", staffIds);

      if (staffErr) {
        console.error("raffle log staff lookup error:", staffErr);
      } else {
        for (const s of (staffRows ?? []) as any[]) {
          const id = Number(s?.id ?? 0);
          if (!id) continue;
          staffNameById.set(id, String(s?.name ?? "").trim());
        }
      }
    }

    const rows = rowsRaw.map((r) => {
      const staffId = Number(r?.staff_id ?? 0);
      return {
        id: String(r?.id ?? ""),
        sold_at: String(r?.sold_at ?? ""),
        customer_name: String(r?.customer_name ?? "").trim(),
        tickets: Number(r?.tickets ?? 0),
        order_id: String(r?.order_id ?? ""),
        staff_name: staffNameById.get(staffId) ?? null,
        deleted_at: r?.deleted_at ? String(r.deleted_at) : null,
      };
    });

    return NextResponse.json({ start, end, page, limit, total: count ?? 0, rows }, { status: 200 });
  } catch (e: any) {
    console.error("raffle log GET fatal:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.staff) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwnerOrAdmin(session.staff.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Soft delete
    const { data, error } = await supabaseServer
      .from("raffle_sales_log")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_staff_id: session.staff.id,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("raffle log delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Row not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("raffle log DELETE fatal:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
