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
      console.error("raffle winner (log) error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? (data as any[]) : [];

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

    if (outRows.length === 0 || total_tickets <= 0) {
      return NextResponse.json(
        { start, end, total_customers: 0, total_tickets: 0, rows: [], winner: null },
        { status: 200 }
      );
    }

    // Weighted pick: random integer in [1..totalTickets]
    const r01 = cryptoRandomFloat01();
    const pick = Math.floor(r01 * total_tickets) + 1;

    let running = 0;
    let winner = outRows[0];

    for (const c of outRows) {
      running += c.tickets;
      if (pick <= running) {
        winner = c;
        break;
      }
    }

    // Wheel geometry (same logic as before)
    let angleCursor = 0;
    let winnerStart = 0;
    let winnerEnd = 0;

    for (const c of outRows) {
      const span = (c.tickets / total_tickets) * 360;
      const startA = angleCursor;
      const endA = angleCursor + span;

      if (c.customer_id === winner.customer_id && c.name === winner.name) {
        winnerStart = startA;
        winnerEnd = endA;
        break;
      }
      angleCursor = endA;
    }

    const pad = Math.min(3, Math.max(0.25, (winnerEnd - winnerStart) * 0.08));
    const innerStart = winnerStart + pad;
    const innerEnd = winnerEnd - pad;

    const r2 = cryptoRandomFloat01();
    const targetAngle = innerStart + (innerEnd - innerStart) * r2;

    return NextResponse.json(
      {
        start,
        end,
        total_customers: outRows.length,
        total_tickets,
        rows: outRows,
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
