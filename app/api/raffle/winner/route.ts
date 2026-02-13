// app/api/raffle/winner/route.ts
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

function cryptoRandomFloat01() {
  // Node runtime supports Web Crypto in Next.js
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 0xffffffff;
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
      console.error("raffle winner error:", error);
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

      if (!prev) byCustomer.set(cid, { customer_id: cid, name, tickets: qty });
      else prev.tickets += qty;
    }

    const customers = Array.from(byCustomer.values()).sort((a, b) => b.tickets - a.tickets);
    const totalTickets = customers.reduce((sum, c) => sum + c.tickets, 0);

    if (customers.length === 0 || totalTickets <= 0) {
      return NextResponse.json(
        { start, end, itemName, totalTickets: 0, customers: [], winner: null },
        { status: 200 }
      );
    }

    // Weighted pick: random integer in [1..totalTickets]
    const r01 = cryptoRandomFloat01();
    const pick = Math.floor(r01 * totalTickets) + 1;

    let running = 0;
    let winner = customers[0];

    for (const c of customers) {
      running += c.tickets;
      if (pick <= running) {
        winner = c;
        break;
      }
    }

    // Wheel geometry (degrees):
    // We'll define 0° at top (12 o'clock) and clockwise rotation.
    // Return the winner's segment [startAngle, endAngle] and a targetAngle within it.
    let angleCursor = 0;
    let winnerStart = 0;
    let winnerEnd = 0;

    for (const c of customers) {
      const span = (c.tickets / totalTickets) * 360;
      const startA = angleCursor;
      const endA = angleCursor + span;

      if (c.customer_id === winner.customer_id) {
        winnerStart = startA;
        winnerEnd = endA;
        break;
      }
      angleCursor = endA;
    }

    // Pick a point safely inside their slice so the pointer doesn't land on a border
    const pad = Math.min(3, Math.max(0.25, (winnerEnd - winnerStart) * 0.08));
    const innerStart = winnerStart + pad;
    const innerEnd = winnerEnd - pad;

    const r2 = cryptoRandomFloat01();
    const targetAngle = innerStart + (innerEnd - innerStart) * r2;

    return NextResponse.json(
      {
        start,
        end,
        itemName,
        totalTickets,
        customers,
        winner,
        wheel: {
          pick,
          winnerStartAngle: winnerStart,
          winnerEndAngle: winnerEnd,
          targetAngle,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("raffle winner fatal:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
