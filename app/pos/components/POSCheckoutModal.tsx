// app/pos/components/POSCheckoutModal.tsx
"use client";

import React, { useMemo, useState } from "react";

export type PaymentMethod = "card" | "voucher" | "split";

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

export default function POSCheckoutModal({
  finalTotal,
  voucherBalance,
  voucherAllowed,
  onConfirm,
  onClose,
  isPaying,
}: {
  finalTotal: number;
  voucherBalance: number;
  voucherAllowed: boolean; // only true for real customers (not staff sales)
  onConfirm: (note: string, payment: { method: PaymentMethod; voucher_used: number; card_charge: number }) => void;
  onClose: () => void;
  isPaying: boolean;
}) {
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");

  const computed = useMemo(() => {
    const total = Math.max(0, Number(finalTotal || 0));
    const voucher = voucherAllowed ? Math.max(0, Number(voucherBalance || 0)) : 0;

    let chosen: PaymentMethod = method;

    // If voucher method selected but not enough voucher, it becomes split automatically
    if (chosen === "voucher" && voucher < total) chosen = "split";
    // If voucher method selected but voucher not allowed, force card
    if (!voucherAllowed && (chosen === "voucher" || chosen === "split")) chosen = "card";

    let voucher_used = 0;
    let card_charge = total;

    if (chosen === "voucher") {
      voucher_used = roundToCents(Math.min(voucher, total));
      card_charge = roundToCents(total - voucher_used);
    } else if (chosen === "split") {
      voucher_used = roundToCents(Math.min(voucher, total));
      card_charge = roundToCents(total - voucher_used);
    } else {
      voucher_used = 0;
      card_charge = roundToCents(total);
    }

    return { chosen, voucher_used, card_charge, total, voucher };
  }, [finalTotal, voucherAllowed, voucherBalance, method]);

  const confirm = () => {
    onConfirm(note, {
      method: computed.chosen,
      voucher_used: computed.voucher_used,
      card_charge: computed.card_charge,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 w-105 p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
        <h2 className="text-2xl font-bold mb-2">Checkout</h2>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Total</span>
            <span className="font-bold text-lg">${Number(computed.total).toFixed(2)}</span>
          </div>

          {voucherAllowed ? (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-300">Voucher Balance</span>
              <span className="font-semibold">${Number(computed.voucher).toFixed(2)}</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 mt-2">
              Voucher payment is only available for real customers (not staff sales).
            </div>
          )}
        </div>

        {/* PAYMENT METHOD */}
        <div className="mb-4">
          <label className="block text-sm text-slate-300 mb-2">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMethod("card")}
              className={`py-2 rounded border ${
                method === "card"
                  ? "bg-(--accent) border-(--accent) text-white"
                  : "bg-slate-800 border-slate-700 hover:bg-slate-700"
              }`}
              disabled={isPaying}
            >
              Card
            </button>

            <button
              type="button"
              onClick={() => setMethod("voucher")}
              className={`py-2 rounded border ${
                method === "voucher"
                  ? "bg-(--accent) border-(--accent) text-white"
                  : "bg-slate-800 border-slate-700 hover:bg-slate-700"
              }`}
              disabled={isPaying || !voucherAllowed}
              title={!voucherAllowed ? "Voucher is only for real customers." : ""}
            >
              Voucher
            </button>

            <button
              type="button"
              onClick={() => setMethod("split")}
              className={`py-2 rounded border ${
                method === "split"
                  ? "bg-(--accent) border-(--accent) text-white"
                  : "bg-slate-800 border-slate-700 hover:bg-slate-700"
              }`}
              disabled={isPaying || !voucherAllowed}
              title={!voucherAllowed ? "Split is only for real customers." : ""}
            >
              Split
            </button>
          </div>

          {/* INSTRUCTIONS */}
          <div className="mt-3 text-sm bg-slate-800 border border-slate-700 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Voucher Used</span>
              <span className="font-semibold">${computed.voucher_used.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-300">Charge on Card</span>
              <span className="font-bold text-emerald-300">${computed.card_charge.toFixed(2)}</span>
            </div>

            {computed.chosen === "split" && computed.voucher_used > 0 ? (
              <p className="text-xs text-slate-400 mt-2">
                Take the voucher portion first, then charge the remainder on card.
              </p>
            ) : null}

            {computed.chosen === "voucher" && computed.card_charge > 0 ? (
              <p className="text-xs text-slate-400 mt-2">
                Voucher isn’t enough to cover the full total — switched to Split automatically.
              </p>
            ) : null}
          </div>
        </div>

        {/* NOTE */}
        <label className="block text-sm text-slate-300 mb-1">Job Note (optional)</label>
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 mb-4"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPaying}
        />

        <div className="flex justify-between gap-3">
          <button
            onClick={onClose}
            className="w-1/2 bg-slate-700 hover:bg-slate-600 py-2 rounded"
            disabled={isPaying}
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={confirm}
            className="w-1/2 bg-(--accent) hover:bg-(--accent-hover) py-2 rounded font-semibold text-white"
            disabled={isPaying}
            type="button"
          >
            {isPaying ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
