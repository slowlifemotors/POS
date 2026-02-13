// app/live/page.tsx
"use client";

import { useEffect, useState } from "react";

type ClockedInUser = {
  id: number; // timesheet id
  staff_id: number;
  name: string;
  clock_in: string;
};

export default function LivePage() {
  const [clockedIn, setClockedIn] = useState<ClockedInUser[]>([]);
  const [loading, setLoading] = useState(true);

  // track which row is being clocked off
  const [clockingOffId, setClockingOffId] = useState<number | null>(null);

  const loadClockedIn = async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      const json = await res.json();
      setClockedIn(json.clocked_in || []);
    } catch (err) {
      console.error("Failed to load live data:", err);
    }
    setLoading(false);
  };

  const clockOff = async (timesheetId: number, name: string) => {
    const ok = confirm(`Clock off ${name}?`);
    if (!ok) return;

    setClockingOffId(timesheetId);
    try {
      const res = await fetch("/api/live/clockoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timesheet_id: timesheetId }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error || "Clock-off failed");
        return;
      }

      // Optimistic UI: remove from list immediately
      setClockedIn((prev) => prev.filter((u) => u.id !== timesheetId));

      // optional: refresh to keep everything consistent
      await loadClockedIn();
    } catch (err) {
      console.error("Clock-off request failed:", err);
      alert("Clock-off request failed");
    } finally {
      setClockingOffId(null);
    }
  };

  useEffect(() => {
    loadClockedIn();
    const interval = setInterval(loadClockedIn, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-slate-100 pt-24 px-8">
      <h1 className="text-3xl font-bold mb-6 text-emerald-400">Live Staff</h1>

      <div className="bg-slate-900 p-6 rounded-xl shadow border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">
          Currently Clocked-In
        </h2>

        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : clockedIn.length === 0 ? (
          <p className="text-slate-500 italic">No staff currently clocked in.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                <th className="p-3 text-left">Staff</th>
                <th className="p-3 text-left">Clocked In At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clockedIn.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-800 hover:bg-slate-800/50"
                >
                  <td className="p-3 text-lg">{u.name}</td>
                  <td className="p-3">
                    {new Date(u.clock_in).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => clockOff(u.id, u.name)}
                      disabled={clockingOffId === u.id}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                        clockingOffId === u.id
                          ? "opacity-60 cursor-not-allowed border-slate-600 bg-slate-800 text-slate-300"
                          : "border-rose-700 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30"
                      }`}
                    >
                      {clockingOffId === u.id ? "Clocking off..." : "Clock Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
