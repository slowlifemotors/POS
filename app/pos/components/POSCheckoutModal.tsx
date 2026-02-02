// app/pos/components/POSCheckoutModal.tsx
"use client";

import { useState } from "react";

export default function POSCheckoutModal({
  finalTotal,
  onConfirm,
  onClose,
  isPaying,
}: {
  finalTotal: number;
  onConfirm: (note: string) => void;
  onClose: () => void;
  isPaying: boolean;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl p-6 w-[420px] shadow-xl border border-slate-700 space-y-4">
        <h2 className="text-2xl font-bold mb-2">Pay (Card)</h2>

        <p className="text-lg">
          Total:{" "}
          <span className="font-bold text-emerald-400">
            ${finalTotal.toFixed(2)}
          </span>
        </p>

        <div>
          <label className="block text-sm mb-1 text-slate-300">
            Note (optional)
          </label>
          <textarea
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded min-h-[90px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Customer requested matte respray + turbo install..."
          />
        </div>

        <button
          className="w-full py-3 bg-(--accent) hover:bg-(--accent-hover) disabled:bg-slate-700 disabled:text-slate-400 rounded-lg font-semibold text-white"
          onClick={() => onConfirm(note)}
          disabled={isPaying}
        >
          {isPaying ? "Processing..." : "Complete Sale (Card)"}
        </button>

        <button
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:bg-slate-800 disabled:text-slate-500"
          onClick={onClose}
          disabled={isPaying}
        >
          Cancel
        </button>

        <p className="text-xs text-slate-400">
          Card is the only payment method. Completing the sale writes a paid order immediately.
        </p>
      </div>
    </div>
  );
}
