// app/pos/components/POSCheckoutModal.tsx
"use client";

import { useState } from "react";

export default function POSCheckoutModal({
  finalTotal,
  onConfirm,
  onClose,
  isPaying = false,
}: {
  finalTotal: number;
  onConfirm: (note: string) => void;
  onClose: () => void;
  isPaying?: boolean;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl p-6 w-[420px] shadow-xl border border-slate-700 space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 text-slate-50">Complete Sale</h2>
          <p className="text-sm text-slate-400">
            Payment method: <span className="font-semibold text-slate-200">Card only</span>
          </p>
        </div>

        <p className="text-lg text-slate-100">
          Total:{" "}
          <span className="font-bold text-emerald-400">${finalTotal.toFixed(2)}</span>
        </p>

        <div>
          <label className="block text-sm mb-1 text-slate-300">Receipt / Sale Note (optional)</label>
          <textarea
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded min-h-[90px] text-slate-100"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Customer requested matte respray + turbo install..."
            disabled={isPaying}
          />
        </div>

        <button
          className="w-full py-3 bg-(--accent) hover:(--accent-hover) rounded-lg font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => onConfirm(note)}
          disabled={isPaying}
        >
          {isPaying ? "Processing..." : "Pay (Card)"}
        </button>

        <button
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={onClose}
          disabled={isPaying}
        >
          Cancel
        </button>

        <p className="text-xs text-slate-400">
          Completing payment will immediately create a{" "}
          <span className="font-semibold">PAID</span> order and send it to{" "}
          <span className="font-semibold">Jobs</span>.
        </p>
      </div>
    </div>
  );
}
