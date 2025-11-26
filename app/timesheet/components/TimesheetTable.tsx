// app/timesheet/components/TimesheetTable.tsx
"use client";

import { formatHours, formatTime, formatDate } from "./formatHours";

interface Entry {
  id: number;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
}

export default function TimesheetTable({ entries }: { entries: Entry[] }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-lg">
      <h2 className="text-xl font-bold text-slate-50 mb-4">Your Timesheet</h2>

      <table className="w-full text-slate-200">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Clock In</th>
            <th className="p-3 text-left">Clock Out</th>
            <th className="p-3 text-left">Hours</th>
          </tr>
        </thead>

        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center p-6 text-slate-500 italic">
                No entries found.
              </td>
            </tr>
          )}

          {entries.map((e) => (
            <tr
              key={e.id}
              className="border-b border-slate-800 hover:bg-slate-800/60 transition"
            >
              <td className="p-3">{formatDate(e.clock_in)}</td>
              <td className="p-3">{formatTime(e.clock_in)}</td>
              <td className="p-3">
                {e.clock_out ? formatTime(e.clock_out) : <span className="text-fuchsia-500">Active</span>}
              </td>
              <td className="p-3">{formatHours(e.hours_worked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
