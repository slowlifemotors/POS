// app/timesheet/admin/components/EditDrawer.tsx
"use client";

import React, { useEffect, useState } from "react";
import { TimesheetEntry } from "./AdminTimesheetTable";

export default function EditDrawer({
  entry,
  open,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: TimesheetEntry | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");

  // Load entry when opening
  useEffect(() => {
    if (entry) {
      setClockIn(entry.clock_in.slice(0, 16));
      setClockOut(entry.clock_out ? entry.clock_out.slice(0, 16) : "");
    }
  }, [entry]);

  if (!open || !entry) return null;

  // ────────────────────────────────────────────
  // Save changes
  // ────────────────────────────────────────────
  const saveChanges = async () => {
    const res = await fetch("/api/timesheet/admin-update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        clock_in: new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      }),
    });

    if (res.ok) {
      onSaved();
      onClose();
    } else {
      alert("Failed to save changes.");
    }
  };

  // ────────────────────────────────────────────
  // Delete entry
  // ────────────────────────────────────────────
  const deleteEntry = async () => {
    if (!confirm("Delete this timesheet entry?")) return;

    const res = await fetch(`/api/timesheet/admin-update?id=${entry.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      onDeleted();
      onClose();
    } else {
      alert("Failed to delete entry.");
    }
  };

  // ────────────────────────────────────────────
  // Component UI
  // ────────────────────────────────────────────
  return (
    <>
      {/* Dimmed background */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Slide-in drawer */}
      <div className="fixed right-0 top-0 h-full w-[400px] bg-slate-900 border-l border-slate-700 shadow-xl z-50 p-6 animate-slide-left">
        <h2 className="text-2xl font-bold text-fuchsia-500 mb-6">
          Edit Timesheet Entry
        </h2>

        {/* Clock In */}
        <label className="block text-slate-300 mb-1">Clock In</label>
        <input
          type="datetime-local"
          value={clockIn}
          onChange={(e) => setClockIn(e.target.value)}
          className="w-full p-3 rounded bg-slate-800 border border-slate-700 mb-5 text-slate-50"
        />

        {/* Clock Out */}
        <label className="block text-slate-300 mb-1">Clock Out</label>
        <input
          type="datetime-local"
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
          className="w-full p-3 rounded bg-slate-800 border border-slate-700 mb-5 text-slate-50"
        />

        {/* Action buttons */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={saveChanges}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 py-3 rounded-lg font-semibold"
          >
            Save Changes
          </button>

          <button
            onClick={deleteEntry}
            className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-semibold"
          >
            Delete Entry
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        .animate-slide-left {
          animation: slide-left 0.25s ease-out;
        }

        @keyframes slide-left {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0%);
          }
        }
      `}</style>
    </>
  );
}
