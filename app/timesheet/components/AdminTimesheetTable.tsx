// app/timesheet/components/AdminTimesheetTable.tsx
"use client";

import { useState } from "react";
import { formatHours, formatTime, formatDate } from "./formatHours";

interface Entry {
  id: number;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
}

export default function AdminTimesheetTable({
  entries,
  onUpdated,
}: {
  entries: Entry[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  function startEdit(entry: Entry) {
    setEditing(entry);
    setEditClockIn(entry.clock_in.slice(0, 16));
    setEditClockOut(entry.clock_out ? entry.clock_out.slice(0, 16) : "");
  }

  async function saveEdit() {
    if (!editing) return;

    const res = await fetch("/api/timesheet/admin-update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        clock_in: new Date(editClockIn).toISOString(),
        clock_out: editClockOut ? new Date(editClockOut).toISOString() : null,
      }),
    });

    if (res.ok) {
      setEditing(null);
      onUpdated();
    } else {
      alert("Failed to update entry");
    }
  }

  async function deleteEntry(id: number) {
    if (!confirm("Delete this entry?")) return;

    const res = await fetch(`/api/timesheet/admin-update?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) onUpdated();
    else alert("Delete failed");
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-lg">
      <h2 className="text-xl font-bold text-slate-50 mb-4">Timesheet Entries</h2>

      <table className="w-full text-slate-200">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Clock In</th>
            <th className="p-3 text-left">Clock Out</th>
            <th className="p-3 text-left">Hours</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center p-6 text-slate-500 italic">
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

              <td className="p-3 text-right">
                <button
                  className="text-amber-400 hover:text-amber-300 mr-4"
                  onClick={() => startEdit(e)}
                >
                  Edit
                </button>

                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteEntry(e.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-[420px] shadow-2xl text-slate-100">
            <h3 className="text-2xl font-bold text-fuchsia-500 mb-4">
              Edit Entry
            </h3>

            <label className="block mb-2 text-sm text-slate-300">Clock In</label>
            <input
              type="datetime-local"
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-4"
              value={editClockIn}
              onChange={(e) => setEditClockIn(e.target.value)}
            />

            <label className="block mb-2 text-sm text-slate-300">Clock Out</label>
            <input
              type="datetime-local"
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-4"
              value={editClockOut}
              onChange={(e) => setEditClockOut(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
