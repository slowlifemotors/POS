// app/timesheet/admin/components/SummaryCards.tsx
"use client";

import React from "react";

export type SummaryData = {
  weekly_hours: number | null | undefined;
  weekly_shifts: number | null | undefined;
  monthly_hours: number | null | undefined;
  monthly_shifts: number | null | undefined;
  avg_shift_hours: number | null | undefined;
};

export default function SummaryCards({
  summary,
  staffName,
}: {
  summary: SummaryData | null;
  staffName: string;
}) {
  if (!summary) {
    return (
      <div className="text-slate-400 italic mt-4">
        Select a staff member to view summary.
      </div>
    );
  }

  // Provide safe fallback values
  const safe = {
    weekly_hours: Number(summary.weekly_hours ?? 0),
    weekly_shifts: Number(summary.weekly_shifts ?? 0),
    monthly_hours: Number(summary.monthly_hours ?? 0),
    monthly_shifts: Number(summary.monthly_shifts ?? 0),
    avg_shift_hours: Number(summary.avg_shift_hours ?? 0),
  };

  const items = [
    {
      label: "Weekly Hours",
      value: `${safe.weekly_hours.toFixed(1)}h`,
      color: "text-emerald-400",
    },
    {
      label: "Weekly Shifts",
      value: safe.weekly_shifts.toString(),
      color: "text-emerald-400",
    },
    {
      label: "Monthly Hours",
      value: `${safe.monthly_hours.toFixed(1)}h`,
      color: "text-fuchsia-400",
    },
    {
      label: "Monthly Shifts",
      value: safe.monthly_shifts.toString(),
      color: "text-fuchsia-400",
    },
    {
      label: "Avg Shift Length",
      value: `${safe.avg_shift_hours.toFixed(1)}h`,
      color: "text-blue-400",
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-4 mt-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg"
        >
          <div className="text-slate-400 text-sm">{item.label}</div>

          <div className={`text-3xl font-semibold mt-2 ${item.color}`}>
            {item.value}
          </div>

          <div className="text-slate-500 text-xs mt-1">
            For {staffName}
          </div>
        </div>
      ))}
    </div>
  );
}
