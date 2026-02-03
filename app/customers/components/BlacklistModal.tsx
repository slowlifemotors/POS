// app/customers/components/BlacklistModal.tsx
"use client";

import { useState } from "react";

export default function BlacklistModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: { id: number; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      alert("Please provide a reason.");
      return;
    }
    if (!start || !end) {
      alert("Please provide start and end dates.");
      return;
    }

    setSaving(true);

    await fetch("/api/customers/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        is_blacklisted: true,        // ✅ FIXED — CORRECT COLUMN
        blacklist_reason: reason.trim(),
        blacklist_start: start,
        blacklist_end: end,
      }),
    });

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-105 text-slate-100 shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-red-400">
          Blacklist {customer.name}
        </h2>

        <textarea
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded mb-3"
          rows={3}
          placeholder="Reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <label className="block mb-1 text-sm">Start Date</label>
        <input
          type="date"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded mb-3"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />

        <label className="block mb-1 text-sm">End Date</label>
        <input
          type="date"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded mb-4"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />

        <div className="flex justify-between mt-4">
          <button
            className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 text-white"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Blacklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
