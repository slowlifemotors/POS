// app/payments/components/PaymentHistoryTable.tsx
"use client";

import React from "react";

export type PaymentRecord = {
  id: number;
  staff_id: number;
  staff_name: string;
  paid_by: number;
  paid_by_name: string;
  period_start: string;
  period_end: string;
  hours_worked: number;
  hourly_pay: number;
  commission: number;
  total_paid: number;
  created_at: string;
};

export default function PaymentHistoryTable({
  records,
  loading,
}: {
  records: PaymentRecord[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl text-slate-300">
        Loading payment history...
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="p-6 bg-slate-900 text-center text-slate-500 italic border border-slate-700 rounded-xl">
        No payment history found.
      </div>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg mt-8">
      <table className="w-full text-slate-200">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            <th className="p-3 text-left">Staff</th>
            <th className="p-3 text-left">Period</th>
            <th className="p-3 text-left">Hours</th>
            <th className="p-3 text-left">Hourly Pay</th>
            <th className="p-3 text-left">Commission</th>
            <th className="p-3 text-left">Total Paid</th>
            <th className="p-3 text-left">Paid By</th>
            <th className="p-3 text-left">Paid At</th>
          </tr>
        </thead>

        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              className="border-b border-slate-800 hover:bg-slate-800/60 transition"
            >
              {/* Staff Name */}
              <td className="p-3 font-medium">{r.staff_name}</td>

              {/* Pay Period */}
              <td className="p-3 text-sm">
                <div>
                  <span className="text-slate-300">Start:</span>{" "}
                  {formatDate(r.period_start)}
                </div>
                <div>
                  <span className="text-slate-300">End:</span>{" "}
                  {formatDate(r.period_end)}
                </div>
              </td>

              {/* Hours */}
              <td className="p-3">{r.hours_worked.toFixed(2)}h</td>

              {/* Hourly Pay */}
              <td className="p-3 text-emerald-300">
                ${r.hourly_pay.toLocaleString()}
              </td>

              {/* Commission */}
              <td className="p-3 text-amber-300">
                ${r.commission.toLocaleString()}
              </td>

              {/* Total Paid */}
              <td className="p-3 text-fuchsia-400 font-bold">
                ${r.total_paid.toLocaleString()}
              </td>

              {/* Paid By */}
              <td className="p-3 text-slate-300">
                {r.paid_by_name || "Unknown"}
              </td>

              {/* Timestamp */}
              <td className="p-3 text-sm text-slate-400">
                {formatDate(r.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
