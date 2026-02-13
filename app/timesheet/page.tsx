// app/timesheet/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ------------------------------
// Types
// ------------------------------
type SummaryResponse = {
  weekly: { hours: number; shifts: number };
  monthly: { hours: number; shifts: number };
  averages: { avg_shift_length: number };
};

type TopHoursResponse = {
  top: {
    staff_id: number;
    staff_name: string;
    hours: number;
  } | null;
};

type TimesheetEntry = {
  id: number;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
};

type PayPeriodMetricsResponse = {
  staff_id: number;
  period: { start: string; end: string };
  profit: number;
  commission: number;
  orders_count: number;
  // commission_rate may exist in API response, but we do NOT display it
  commission_rate?: number;
};

// ------------------------------
// Timezone Helpers (Australia/Melbourne)
// ------------------------------
const MEL_TZ = "Australia/Melbourne";

function formatMelbourneDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: MEL_TZ,
    hour12: false,
  });
}

function formatMelbourneDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: MEL_TZ,
  });
}

// ------------------------------
// Main Component
// ------------------------------
export default function TimesheetPage() {
  const [session, setSession] = useState<any>(null);

  const [mySummary, setMySummary] = useState<SummaryResponse | null>(null);
  const [topHours, setTopHours] = useState<TopHoursResponse["top"] | null>(null);

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [clockedInEntry, setClockedInEntry] = useState<TimesheetEntry | null>(
    null
  );

  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);

  const [payMetrics, setPayMetrics] = useState<PayPeriodMetricsResponse | null>(
    null
  );

  // ------------------------------
  // Load Session
  // ------------------------------
  const loadSession = async () => {
    const res = await fetch("/api/auth/session");
    const json = await res.json();
    setSession(json?.staff || null);
  };

  // ------------------------------
  // Load My Summary
  // ------------------------------
  const loadMySummary = async () => {
    const res = await fetch("/api/timesheet/my-summary");
    const json = await res.json();
    setMySummary(json);
  };

  // ------------------------------
  // Load Top Hours Leaderboard
  // ------------------------------
  const loadTopHours = async () => {
    const res = await fetch("/api/timesheet/top-hours");
    const json = await res.json();
    setTopHours(json.top);
  };

  // ------------------------------
  // Load My Pay Period Metrics (profit + commission)
  // ------------------------------
  const loadPayPeriodMetrics = async () => {
    const res = await fetch("/api/payments/my-period-metrics", {
      cache: "no-store",
    });

    if (!res.ok) {
      setPayMetrics(null);
      return;
    }

    const json = await res.json();

    const valid =
      json &&
      json.period &&
      typeof json.profit === "number" &&
      typeof json.commission === "number" &&
      typeof json.orders_count === "number";

    setPayMetrics(valid ? json : null);
  };

  // ------------------------------
  // Load My Timesheet Entries
  // ------------------------------
  const loadEntries = async () => {
    const res = await fetch("/api/timesheet/list?staff_id=" + session.id);
    const json = await res.json();

    setEntries(json.entries || []);

    const active = json.entries?.find((e: any) => e.clock_out === null);
    setClockedInEntry(active || null);
  };

  // ------------------------------
  // Clock In / Out
  // ------------------------------
  const clockIn = async () => {
    await fetch("/api/timesheet/clockin", { method: "POST" });
    await loadEntries();
    await loadMySummary();
  };

  const clockOut = async () => {
    await fetch("/api/timesheet/clockout", { method: "POST" });
    await loadEntries();
    await loadMySummary();
    await loadPayPeriodMetrics();
  };

  // ------------------------------
  // Timer Effect
  // ------------------------------
  useEffect(() => {
    let interval: any;

    if (clockedInEntry) {
      interval = setInterval(() => {
        const diff =
          (Date.now() - new Date(clockedInEntry.clock_in).getTime()) / 1000;
        setTimer(diff);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [clockedInEntry]);

  // ------------------------------
  // Initial Loads
  // ------------------------------
  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (session) {
      Promise.all([loadEntries(), loadMySummary(), loadTopHours(), loadPayPeriodMetrics()]);
      setLoading(false);
    }
  }, [session]);

  // ------------------------------
  // Format Helpers
  // ------------------------------
  const fmt = {
    hours: (h: number) => `${h.toFixed(1)}h`,
    time: (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h ${m}m`;
    },
    dateTime: (iso: string) => formatMelbourneDateTime(iso),
    money: (n: number) =>
      Number(n || 0).toLocaleString("en-AU", {
        style: "currency",
        currency: "AUD",
      }),
  };

  // ------------------------------
  // UI Start
  // ------------------------------
  if (loading || !mySummary) {
    return <div className="text-slate-200 p-10 text-xl">Loading timesheet...</div>;
  }

  const role = (session?.role || "").toLowerCase().trim();
  const isPrivileged = role === "admin" || role === "owner" || role === "manager";

  const payPeriodLabel =
    payMetrics?.period?.start && payMetrics?.period?.end
      ? `${formatMelbourneDate(payMetrics.period.start)} → ${formatMelbourneDate(
          payMetrics.period.end
        )}`
      : null;

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8 pb-20">
      {/* ============================================
          CLOCK IN / CLOCK OUT (top, alone)
      ============================================ */}
      <div className="mb-10 flex flex-col items-start">
        {clockedInEntry ? (
          <>
            <button
              onClick={clockOut}
              className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-3 text-lg rounded-lg shadow-xl"
            >
              Clock Out
            </button>
            <p className="text-slate-400 mt-3 text-lg">
              Active shift — {fmt.time(timer)}
            </p>
          </>
        ) : (
          <button
            onClick={clockIn}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-lg rounded-lg shadow-xl"
          >
            Clock In
          </button>
        )}
      </div>

      {/* ============================================
          ROW 1 (3 tiles)
          Monthly Top Hours | Your Monthly Hours | Avg Shift Length
      ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Monthly Top Hours */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Monthly Top Hours</div>
          <div className="text-2xl font-bold text-[color:var(--accent)]">
            {topHours ? `${topHours.staff_name} — ${fmt.hours(topHours.hours)}` : "No data"}
          </div>
        </div>

        {/* Your Monthly Hours (red) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Your Monthly Hours</div>
          <div className="text-2xl font-bold text-red-400">
            {fmt.hours(mySummary.monthly.hours)}
          </div>
        </div>

        {/* Avg Shift Length */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Avg Shift Length</div>
          <div className="text-2xl font-bold text-red-400">
            {mySummary.averages.avg_shift_length.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* ============================================
          ROW 2 (3 tiles)
          Pay Period Profit | Pay Period Commission | Shifts this month
      ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Pay Period Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Pay Period Profit</div>
          <div className="text-2xl font-bold text-red-400">
            {payMetrics ? fmt.money(payMetrics.profit) : fmt.money(0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {payPeriodLabel ? `Current pay period: ${payPeriodLabel}` : " "}
          </div>
        </div>

        {/* Pay Period Commission (do NOT show %) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Pay Period Commission</div>
          <div className="text-2xl font-bold text-red-400">
            {payMetrics ? fmt.money(payMetrics.commission) : fmt.money(0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {payMetrics ? `${payMetrics.orders_count} orders` : " "}
          </div>
        </div>

        {/* Shifts this month */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-lg text-slate-300 mb-1">Shifts This Month</div>
          <div className="text-2xl font-bold text-red-400">
            {mySummary.monthly.shifts}
          </div>
        </div>
      </div>

      {/* ============================================
          ADMIN LINK
      ============================================ */}
      {isPrivileged && (
        <div className="mb-12">
          <Link
            href="/timesheet/admin"
            className="underline text-lg
              text-[color:var(--accent)]
              hover:text-[color:var(--accent-hover)]"
          >
            Manage Timesheets →
          </Link>
        </div>
      )}

      {/* ============================================
          TIMESHEET TABLE
      ============================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-slate-800 text-slate-300 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Clock In</th>
              <th className="p-3 text-left">Clock Out</th>
              <th className="p-3 text-left">Hours</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-800 hover:bg-slate-800/50"
              >
                <td className="p-3">{fmt.dateTime(e.clock_in)}</td>
                <td className="p-3">{e.clock_out ? fmt.dateTime(e.clock_out) : "-"}</td>
                <td className="p-3">{e.hours_worked ? e.hours_worked.toFixed(2) : "0.00"}</td>
              </tr>
            ))}

            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center p-6 text-slate-500 italic">
                  No timesheet entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
