// app/api/raffle/summary/route.ts
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

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isManagerOrAbove(session.staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const start = asYMD(url.searchParams.get("start"));
    const end = asYMD(url.searchParams.get("end"));

    if (!start || !end) {
      return NextResponse.json({ error: "start and end (YYYY-MM-DD) are required" }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: "start must be <= end" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("raffle_sales_log")
      .select("customer_id, customer_name, tickets, sold_at, deleted_at")
      .is("deleted_at", null)
      .gte("sold_at", startOfDayISO(start))
      .lte("sold_at", endOfDayISO(end))
      .limit(200000);

    if (error) {
      console.error("raffle summary (log) error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? (data as any[]) : [];

    // Group by (customer_id??0 + customer_name)
    const keyOf = (cid: unknown, name: unknown) => {
      const id = Number(cid ?? 0);
      const safeId = Number.isFinite(id) ? id : 0;
      const nm = String(name ?? "").trim() || "Unknown";
      return `${safeId}::${nm.toLowerCase()}`;
    };

    const agg = new Map<string, { customer_id: number; name: string; tickets: number }>();

    for (const r of rows) {
      const t = Number(r?.tickets ?? 0);
      if (!Number.isFinite(t) || t <= 0) continue;

      const cidRaw = Number(r?.customer_id ?? 0);
      const cid = Number.isFinite(cidRaw) ? cidRaw : 0;
      const name = String(r?.customer_name ?? "").trim() || (cid ? `Customer #${cid}` : "Unknown");

      const k = keyOf(cid, name);
      const cur = agg.get(k);
      if (!cur) {
        agg.set(k, { customer_id: cid, name, tickets: t });
      } else {
        cur.tickets += t;
      }
    }

    const outRows = Array.from(agg.values())
      .filter((x) => x.tickets > 0)
      .sort((a, b) => b.tickets - a.tickets);

    const total_tickets = outRows.reduce((sum, r) => sum + r.tickets, 0);

    // Match your raffle page expectations (it already handles rows + total_tickets)
    return NextResponse.json(
      {
        start,
        end,
        total_customers: outRows.length,
        total_tickets,
        rows: outRows,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("raffle summary fatal:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
