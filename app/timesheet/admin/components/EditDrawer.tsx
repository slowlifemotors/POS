// app/timesheet/admin/components/EditDrawer.tsx
"use client";

import React, { useEffect, useState } from "react";
import { TimesheetEntry } from "./AdminTimesheetTable";

const MEL_TZ = "Australia/Melbourne";

function partsInTimeZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// ISO (UTC) -> "YYYY-MM-DDTHH:mm" in Melbourne for datetime-local
function isoToMelbourneInput(iso: string) {
  const d = new Date(iso);
  const p = partsInTimeZone(d, MEL_TZ);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function melbourneLocalToIso(localValue: string) {
  // localValue: "YYYY-MM-DDTHH:mm"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue);
  if (!m) return new Date(localValue).toISOString();

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  // Try possible DST offsets for Melbourne (+10, +11)
  const offsets = [600, 660]; // minutes ahead of UTC
  for (const offsetMin of offsets) {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60_000;
    const test = new Date(utcMs);
    const p = partsInTimeZone(test, MEL_TZ);

    const matches =
      Number(p.year) === year &&
      Number(p.month) === month &&
      Number(p.day) === day &&
      Number(p.hour) === hour &&
      Number(p.minute) === minute;

    if (matches) return test.toISOString();
  }

  // Fallback: assume +10 if no match (rare edge cases during DST transitions)
  const fallbackUtcMs =
    Date.UTC(year, month - 1, day, hour, minute) - 600 * 60_000;
  return new Date(fallbackUtcMs).toISOString();
}

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

  // Load entry when opening (Melbourne local time in input)
  useEffect(() => {
    if (entry) {
      setClockIn(isoToMelbourneInput(entry.clock_in));
      setClockOut(entry.clock_out ? isoToMelbourneInput(entry.clock_out) : "");
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
        clock_in: clockIn ? melbourneLocalToIso(clockIn) : null,
        clock_out: clockOut ? melbourneLocalToIso(clockOut) : null,
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
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Slide-in drawer */}
      <div className="fixed right-0 top-0 h-full w-[400px] bg-slate-900 border-l border-slate-700 shadow-xl z-50 p-6 animate-slide-left">
        <h2 className="text-2xl font-bold text-fuchsia-500 mb-6">
          Edit Timesheet Entry
        </h2>

        {/* Clock In */}
        <label className="block text-slate-300 mb-1">
          Clock In (Melbourne)
        </label>
        <input
          type="datetime-local"
          value={clockIn}
          onChange={(e) => setClockIn(e.target.value)}
          className="w-full p-3 rounded bg-slate-800 border border-slate-700 mb-5 text-slate-50"
        />

        {/* Clock Out */}
        <label className="block text-slate-300 mb-1">
          Clock Out (Melbourne)
        </label>
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
