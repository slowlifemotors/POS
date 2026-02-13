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

    const itemNameRaw = (url.searchParams.get("itemName") ?? "Raffle Ticket").trim();
    const itemName = itemNameRaw || "Raffle Ticket";

    if (!start || !end) {
      return NextResponse.json({ error: "start and end (YYYY-MM-DD) are required" }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: "start must be <= end" }, { status: 400 });
    }

    // Pull all order_lines matching "Raffle Ticket" in a paid order within range.
    // Note: this assumes tickets are sold via order_lines.mod_name = "Raffle Ticket"
    // and orders.customer_id points to customers.
    const { data, error } = await supabaseServer
      .from("order_lines")
      .select(
        `
        id,
        quantity,
        mod_name,
        orders!inner(
          id,
          created_at,
          status,
          customer_id,
          customer_is_staff,
          customers!inner(
            id,
            name
          )
        )
      `
      )
      .ilike("mod_name", itemName)
      .eq("orders.status", "paid")
      .eq("orders.customer_is_staff", false)
      .not("orders.customer_id", "is", null)
      .gte("orders.created_at", startOfDayISO(start))
      .lte("orders.created_at", endOfDayISO(end))
      .limit(100000);

    if (error) {
      console.error("raffle summary error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    const byCustomer = new Map<number, { customer_id: number; name: string; tickets: number }>();

    for (const r of rows as any[]) {
      const qty = Number(r?.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const cust = r?.orders?.customers;
      const cid = Number(cust?.id ?? 0);
      if (!Number.isFinite(cid) || cid <= 0) continue;

      const name = String(cust?.name ?? "").trim() || `Customer #${cid}`;
      const prev = byCustomer.get(cid);

      if (!prev) {
        byCustomer.set(cid, { customer_id: cid, name, tickets: qty });
      } else {
        prev.tickets += qty;
      }
    }

    const customers = Array.from(byCustomer.values()).sort((a, b) => b.tickets - a.tickets);
    const totalTickets = customers.reduce((sum, c) => sum + c.tickets, 0);

    return NextResponse.json(
      {
        start,
        end,
        itemName,
        totalTickets,
        customers,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("raffle summary fatal:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
