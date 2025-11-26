// app/payments/components/PaymentHeaderStats.tsx
"use client";

import React, { useEffect, useState } from "react";

type MonthlyHours = {
  staff_id: number;
  name: string;
  hours: number;
};

export default function PaymentHeaderStats({
  session,
}: {
  session: any;
}) {
  const [topHours, setTopHours] = useState<MonthlyHours | null>(null);
  const [yourHours, setYourHours] = useState<MonthlyHours | null>(null);
  const [loading, setLoading] = useState(true);

  // Ensure session is valid before loading
  const userId = session?.id || session?.staff_id || session?.staff?.id;

  const loadStats = async () => {
    if (!userId) return;

    setLoading(true);

    try {
      // Fetch top performer
      const topRes = await fetch("/api/timesheet/top-month-hours");
      const topJson = await topRes.json();
      setTopHours(topJson?.top || null);

      // Fetch logged-in user's monthly hours
      const yourRes = await fetch(
        `/api/timesheet/user-month-hours?staff_id=${userId}`
      );
      const yourJson = await yourRes.json();
      setYourHours(yourJson?.user || null);
    } catch (err) {
      console.error("Failed to load payment header stats:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
        <p className="text-slate-400">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* TOP HOURS CARD */}
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow">
        <h3 className="text-xl font-bold text-fuchsia-400 mb-2">
          Monthly Top Hours
        </h3>

        {topHours ? (
          <p className="text-slate-300 text-lg">
            {topHours.name} —{" "}
            <span className="text-fuchsia-300 font-semibold">
              {topHours.hours.toFixed(2)}h
            </span>
          </p>
        ) : (
          <p className="text-slate-500 italic">No data available</p>
        )}
      </div>

      {/* YOUR HOURS CARD */}
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow">
        <h3 className="text-xl font-bold text-emerald-400 mb-2">
          Your Monthly Hours
        </h3>

        {yourHours ? (
          <p className="text-slate-300 text-lg">
            {yourHours.name} —{" "}
            <span className="text-emerald-300 font-semibold">
              {yourHours.hours.toFixed(2)}h
            </span>
          </p>
        ) : (
          <p className="text-slate-500 italic">No data available</p>
        )}
      </div>
    </div>
  );
}
