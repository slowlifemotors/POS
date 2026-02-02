// app/payments/components/ConfirmPaymentModal.tsx
"use client";

import React, { useState } from "react";

interface PaySummary {
  staff_id: number;
  period: {
    start: string | Date;
    end: string | Date;
  };
  hours: {
    total: number;
    hourly_rate: number;
    hourly_pay: number;
  };
  commission: {
    rate: number;
    profit: number;
    value: number;
  };
  total_pay: number;
}

export default function ConfirmPaymentModal({
  open,
  onClose,
  summary,
  staffName,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  summary: PaySummary | null;
  staffName: string;
  onPaid: () => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!open || !summary) return null;

  const s = summary;

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  async function confirmPayment() {
    setLoading(true);

    const body = {
      staff_id: s.staff_id,
      period_start: s.period.start,
      period_end: s.period.end,

      // HOURS
      hours: s.hours.total,
      hourly_rate: s.hours.hourly_rate,
      hourly_pay: s.hours.hourly_pay,

      // COMMISSION
      commission_rate: s.commission.rate,
      commission_profit: s.commission.profit,
      commission_value: s.commission.value,

      // TOTAL
      total_pay: s.total_pay,
    };

    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setLoading(false);
      onPaid();
      onClose();
    } else {
      setLoading(false);
      alert("Payment failed. Check backend logs.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-[420px] shadow-2xl text-slate-100">
        <h2 className="text-2xl font-bold mb-4 text-fuchsia-400">
          Confirm Payment
        </h2>

        <p className="mb-4 text-slate-300">
          You are about to pay <strong>{staffName}</strong>.
        </p>

        {/* PAY PERIOD */}
        <div className="mb-4 bg-slate-800 p-4 rounded border border-slate-700">
          <h3 className="font-semibold mb-1 text-fuchsia-300">Pay Period</h3>
          <p className="text-sm">
            <strong>Start:</strong> {formatDate(s.period.start)}
          </p>
          <p className="text-sm">
            <strong>End:</strong> {formatDate(s.period.end)}
          </p>
        </div>

        {/* HOURS */}
        <div className="mb-4 bg-slate-800 p-4 rounded border border-slate-700">
          <h3 className="font-semibold mb-1 text-emerald-300">Hours</h3>
          <div className="grid grid-cols-2 text-sm text-slate-300">
            <p>Total Hours:</p>
            <p className="text-right">{s.hours.total.toFixed(2)}h</p>

            <p>Hourly Rate:</p>
            <p className="text-right">
              ${s.hours.hourly_rate.toLocaleString()}
            </p>

            <p>Hourly Pay:</p>
            <p className="text-right text-emerald-400">
              ${s.hours.hourly_pay.toLocaleString()}
            </p>
          </div>
        </div>

        {/* COMMISSION */}
        <div className="mb-4 bg-slate-800 p-4 rounded border border-slate-700">
          <h3 className="font-semibold mb-1 text-amber-300">Commission</h3>
          <div className="grid grid-cols-2 text-sm text-slate-300">
            <p>Rate:</p>
            <p className="text-right">{s.commission.rate}%</p>

            <p>Profit After Discount:</p>
            <p className="text-right">
              ${s.commission.profit.toLocaleString()}
            </p>

            <p>Commission Pay:</p>
            <p className="text-right text-amber-400">
              ${s.commission.value.toLocaleString()}
            </p>
          </div>
        </div>

        {/* TOTAL PAY */}
        <div className="flex justify-between p-4 border border-slate-700 rounded-lg bg-slate-900 mb-6">
          <span className="font-bold text-lg">TOTAL</span>
          <span className="text-2xl font-extrabold text-fuchsia-400">
            ${s.total_pay.toLocaleString()}
          </span>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            onClick={confirmPayment}
            disabled={loading}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded text-white"
          >
            {loading ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
