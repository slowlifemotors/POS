// app/timesheet/admin/components/StaffSelector.tsx
"use client";

import React, { useState, useEffect } from "react";

type StaffRecord = {
  id: number;
  name: string;
  role: string;
};

export default function StaffSelector({
  staff,
  selectedStaff,
  onSelect,
}: {
  staff: StaffRecord[];
  selectedStaff: StaffRecord | null;
  onSelect: (staff: StaffRecord | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<StaffRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Filter staff when search query changes
  useEffect(() => {
    const q = query.toLowerCase();

    const list = staff.filter((s) =>
      s.name.toLowerCase().includes(q)
    );

    setFiltered(list);
    setHighlightIndex(0);
  }, [query, staff]);

  // Handle keyboard navigation
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) setOpen(true);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) =>
        Math.min(i + 1, filtered.length - 1)
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }

    if (e.key === "Enter" && filtered[highlightIndex]) {
      e.preventDefault();
      onSelect(filtered[highlightIndex]);
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <label className="text-slate-300 mb-2 block">
        Select Staff
      </label>

      {/* Search input */}
      <input
        type="text"
        placeholder={
          selectedStaff
            ? `Selected: ${selectedStaff.name}`
            : "Search staff..."
        }
        onFocus={() => setOpen(true)}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKey}
        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
      />

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-40 mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-slate-500 italic">
              No staff found
            </div>
          ) : (
            filtered.map((s, index) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                  setQuery("");
                }}
                className={`p-3 cursor-pointer transition ${
                  index === highlightIndex
                    ? "bg-fuchsia-600 text-white"
                    : "hover:bg-slate-800"
                }`}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-slate-400">
                  {s.role}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Dim background to close dropdown */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
