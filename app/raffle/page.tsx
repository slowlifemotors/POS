// app/raffle/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RaffleCustomer = {
  customer_id: number;
  name: string;
  tickets: number;
};

type SummaryResponse = {
  start: string;
  end: string;
  totalTickets: number;
  customers: RaffleCustomer[];
};

type WinnerResponse = SummaryResponse & {
  winner: RaffleCustomer | null;
  wheel?: {
    pick: number;
    winnerStartAngle: number;
    winnerEndAngle: number;
    targetAngle: number;
  };
};

function todayYMDLocal() {
  // Use local date for the input[type=date] default
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTopCW: number) {
  // 0° = top, clockwise
  const angleRad = ((angleDegFromTopCW - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${end.x} ${end.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${start.x} ${start.y}`,
    "Z",
  ].join(" ");
}

export default function RafflePage() {
  const router = useRouter();

  const [start, setStart] = useState<string>(todayYMDLocal());
  const [end, setEnd] = useState<string>(todayYMDLocal());

  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [winner, setWinner] = useState<RaffleCustomer | null>(null);

  // Wheel animation state
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const spinTimerRef = useRef<number | null>(null);

  // Basic auth gate (admin/owner/manager only)
  useEffect(() => {
    async function check() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!json?.staff) {
        router.push("/login");
        return;
      }
      const role = String(json?.staff?.role ?? "").toLowerCase();
      const ok = role === "owner" || role === "admin" || role === "manager";
      if (!ok) router.push("/");
    }
    check();
  }, [router]);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  function validateRange() {
    if (!start || !end) return "Pick a start and end date.";
    if (start > end) return "Start date must be on or before end date.";
    return null;
  }

  async function loadSummary() {
    const rangeErr = validateRange();
    if (rangeErr) {
      setError(rangeErr);
      return;
    }

    setError(null);
    setLoading(true);
    setWinner(null);

    try {
      // ✅ Updated to match the new API:
      // /api/raffle/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
      const res = await fetch(
        `/api/raffle/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { cache: "no-store" }
      );

      const json = (await safeJson(res)) as any;

      if (!res.ok) throw new Error(json?.error || `Failed to load summary (${res.status})`);

      // New API shape:
      // {
      //   start, end,
      //   total_customers, total_tickets,
      //   rows: [{ customer_id, name, tickets }]
      // }
      const customers: RaffleCustomer[] = Array.isArray(json.rows) ? json.rows : [];
      const totalTickets = Number(json.total_tickets ?? 0);

      setSummary({
        start: String(json.start ?? start),
        end: String(json.end ?? end),
        totalTickets,
        customers,
      });
    } catch (e: any) {
      setSummary(null);
      setError(e?.message ?? "Failed to load raffle summary.");
    } finally {
      setLoading(false);
    }
  }

  async function spinWinner() {
    if (!summary || summary.totalTickets <= 0 || summary.customers.length === 0) {
      setError("No raffle tickets found for this date range.");
      return;
    }
    if (spinning) return;

    const rangeErr = validateRange();
    if (rangeErr) {
      setError(rangeErr);
      return;
    }

    setError(null);
    setSpinning(true);
    setWinner(null);

    try {
      // NOTE: This assumes your /api/raffle/winner endpoint exists.
      // If your winner endpoint still expects itemName, update it to match summary API.
      const res = await fetch(
        `/api/raffle/winner?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { cache: "no-store" }
      );

      const json = (await safeJson(res)) as any;
      if (!res.ok) throw new Error(json?.error || `Failed to pick winner (${res.status})`);

      // Expect winner endpoint to return the same shape as summary, plus winner + wheel data.
      const customers: RaffleCustomer[] = Array.isArray(json.rows)
        ? json.rows
        : Array.isArray(json.customers)
        ? json.customers
        : [];

      const totalTickets = Number(json.total_tickets ?? json.totalTickets ?? 0);

      const winnerObj =
        json.winner && typeof json.winner === "object" ? (json.winner as RaffleCustomer) : null;

      const targetAngle = Number(json?.wheel?.targetAngle ?? 0);

      // Keep table in sync with the server response
      setSummary({
        start: String(json.start ?? start),
        end: String(json.end ?? end),
        totalTickets,
        customers,
      });

      // Wheel animation:
      // pointer at top (0°) should land on targetAngle slice.
      const normalize = (a: number) => ((a % 360) + 360) % 360;
      const current = normalize(rotationDeg);

      const desired = normalize(360 - normalize(targetAngle)); // == (-targetAngle mod 360)
      const extraSpins = 6 * 360;
      const delta = normalize(desired - current);

      const finalRotation = rotationDeg + extraSpins + delta;

      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);

      setRotationDeg(finalRotation);

      spinTimerRef.current = window.setTimeout(() => {
        setWinner(winnerObj);
        setSpinning(false);
      }, 5200);
    } catch (e: any) {
      setSpinning(false);
      setError(e?.message ?? "Failed to spin winner.");
    }
  }

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
    };
  }, []);

  const canSpin = useMemo(() => {
    return !!summary && summary.totalTickets > 0 && summary.customers.length > 0 && !loading && !spinning;
  }, [summary, loading, spinning]);

  const wheelSlices = useMemo(() => {
    if (!summary || summary.totalTickets <= 0) return [];

    let cursor = 0;
    return summary.customers.map((c) => {
      const span = (c.tickets / summary.totalTickets) * 360;
      const startA = cursor;
      const endA = cursor + span;
      cursor = endA;

      return {
        ...c,
        startA,
        endA,
        span,
      };
    });
  }, [summary]);

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Raffle Tickets</h1>

        <div className="flex gap-3">
          <button
            onClick={loadSummary}
            className="px-4 py-2 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700"
            type="button"
            disabled={loading || spinning}
          >
            {loading ? "Loading..." : "Load"}
          </button>

          <button
            onClick={spinWinner}
            className="px-4 py-2 rounded-lg font-semibold bg-(--accent) hover:bg-(--accent-hover)"
            type="button"
            disabled={!canSpin}
          >
            {spinning ? "Spinning..." : "Spin Winner"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-700/50 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">Filter</h2>

          <label className="block text-sm text-slate-300 mb-1">Start Date</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full mb-4 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
          />

          <label className="block text-sm text-slate-300 mb-1">End Date</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full mb-4 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
          />

          <div className="text-sm text-slate-400">
            {summary ? (
              <>
                <div className="mt-2">
                  Total Tickets:{" "}
                  <span className="text-slate-200 font-semibold">{summary.totalTickets}</span>
                </div>
                <div className="mt-1">
                  Customers:{" "}
                  <span className="text-slate-200 font-semibold">{summary.customers.length}</span>
                </div>
              </>
            ) : (
              <div className="mt-2">Load a date range to see ticket counts.</div>
            )}
          </div>

          {winner && (
            <div className="mt-5 p-3 rounded-lg border border-emerald-700/40 bg-emerald-900/20">
              <div className="text-emerald-200 font-semibold">Winner</div>
              <div className="text-lg font-bold text-emerald-100">{winner.name}</div>
              <div className="text-sm text-emerald-200/80">Tickets: {winner.tickets}</div>
            </div>
          )}
        </div>

        {/* Wheel */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-4">Wheel</h2>

          <div className="relative">
            {/* Pointer */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
              <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-white drop-shadow" />
            </div>

            {/* Wheel */}
            <div
              className="rounded-full border border-slate-600 shadow-xl bg-slate-800"
              style={{
                width: 360,
                height: 360,
                transform: `rotate(${rotationDeg}deg)`,
                transition: spinning
                  ? "transform 5s cubic-bezier(0.12, 0.88, 0.18, 1)"
                  : "transform 200ms linear",
              }}
            >
              <svg width="360" height="360" viewBox="0 0 360 360" className="rounded-full">
                <defs>
                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Slices */}
                {wheelSlices.length === 0 ? (
                  <circle cx="180" cy="180" r="170" fill="transparent" />
                ) : (
                  wheelSlices.map((s, idx) => {
                    const fill = idx % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)";
                    const d = describeArc(180, 180, 170, s.startA, s.endA);

                    const mid = (s.startA + s.endA) / 2;
                    const pt = polarToCartesian(180, 180, 110, mid);

                    const display = s.name.length > 16 ? `${s.name.slice(0, 16).trim()}…` : s.name;

                    return (
                      <g key={`${s.customer_id}-${idx}`} filter="url(#shadow)">
                        <path d={d} fill={fill} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                        {s.span >= 10 && (
                          <text
                            x={pt.x}
                            y={pt.y}
                            fill="rgba(255,255,255,0.85)"
                            fontSize="11"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ userSelect: "none" }}
                            transform={`rotate(${mid} ${pt.x} ${pt.y})`}
                          >
                            {display}
                          </text>
                        )}
                      </g>
                    );
                  })
                )}

                {/* Center */}
                <circle
                  cx="180"
                  cy="180"
                  r="38"
                  fill="rgba(0,0,0,0.35)"
                  stroke="rgba(255,255,255,0.15)"
                />
                <text
                  x="180"
                  y="180"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="12"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ userSelect: "none" }}
                >
                  SPIN
                </text>
              </svg>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400 text-center max-w-md">
            Slice sizes are based on how many <span className="text-slate-200">Raffle Ticket</span> items were sold to each
            customer in PAID (non-voided) orders within the selected date range.
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">Customers</h2>

          {!summary ? (
            <div className="text-slate-400">Load a date range to see results.</div>
          ) : summary.customers.length === 0 ? (
            <div className="text-slate-400">No tickets found for this range.</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto border border-slate-800 rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 border-b border-slate-700 sticky top-0">
                  <tr>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-right">Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.customers.map((c) => (
                    <tr key={c.customer_id} className="border-b border-slate-800">
                      <td className="p-3">{c.name}</td>
                      <td className="p-3 text-right font-semibold">{c.tickets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary && summary.customers.length > 0 && (
            <div className="mt-3 text-xs text-slate-400">
              Total tickets: <span className="text-slate-200 font-semibold">{summary.totalTickets}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
