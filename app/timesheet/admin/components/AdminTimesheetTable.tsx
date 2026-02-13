// app/timesheet/admin/components/AdminTimesheetTable.tsx
"use client";

import React from "react";

export type TimesheetEntry = {
  id: number;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number;
};

const MEL_TZ = "Australia/Melbourne";

function formatMelbourne(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: MEL_TZ,
    hour12: false,
  });
}

export default function AdminTimesheetTable({
  entries,
  onSelectEntry,
}: {
  entries: TimesheetEntry[];
  onSelectEntry: (entry: TimesheetEntry) => void;
}) {
  return (
    <div className="mt-10 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <table className="w-full text-slate-200">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            <th className="p-3 text-left">Clock In</th>
            <th className="p-3 text-left">Clock Out</th>
            <th className="p-3 text-left">Hours</th>
          </tr>
        </thead>

        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                No timesheet entries for this staff member.
              </td>
            </tr>
          )}

          {entries.map((e) => (
            <tr
              key={e.id}
              onClick={() => onSelectEntry(e)}
              className="border-b border-slate-800 hover:bg-slate-800/60 cursor-pointer transition"
            >
              <td className="p-3">{formatMelbourne(e.clock_in)}</td>

              <td className="p-3">
                {e.clock_out ? (
                  formatMelbourne(e.clock_out)
                ) : (
                  <span className="text-fuchsia-500">Active</span>
                )}
              </td>

              <td className="p-3">{e.hours_worked?.toFixed(2)}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
