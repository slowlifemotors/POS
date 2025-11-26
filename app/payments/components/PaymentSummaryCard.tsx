// app/payments/components/PaymentSummaryCard.tsx
"use client";

import React from "react";

interface Props {
  summary: {
    staff_id: number;
    period: {
      start: string;
      end: string;
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
    last_paid?: string | null;
  };
}

export default function PaymentSummaryCard({ summary }: Props) {
  const {
    period,
    hours,
    commission,
    total_pay,
    last_paid
  } = summary;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg">

      {/* TITLE */}
      <h2 className="text-2xl font-bold mb-4 text-fuchsia-400">
        Payment Summary
      </h2>

      {/* PAY PERIOD */}
      <div className="mb-6">
        <p className="text-slate-400 uppercase tracking-wider text-xs">
          Pay Period
        </p>
        <p className="text-lg font-semibold text-slate-200">
          {formatDate(period.start)} → {formatDate(period.end)}
        </p>
      </div>

      <div className="border-t border-slate-700 my-4"></div>

      {/* HOURS SECTION */}
      <div className="mb-6">
        <p className="text-slate-400 uppercase tracking-wider text-xs mb-2">
          Hours Worked
        </p>

        <div className="flex justify-between text-slate-300">
          <span>Total Hours:</span>
          <span className="font-semibold">{hours.total.toFixed(2)}h</span>
        </div>

        <div className="flex justify-between text-slate-300 mt-1">
          <span>Hourly Rate:</span>
          <span className="font-semibold">
            ${hours.hourly_rate.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-300 mt-1">
          <span>Hourly Pay:</span>
          <span className="font-semibold">
            ${hours.hourly_pay.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-700 my-4"></div>

      {/* COMMISSION SECTION */}
      <div className="mb-6">
        <p className="text-slate-400 uppercase tracking-wider text-xs mb-2">
          Commission
        </p>

        <div className="flex justify-between text-slate-300">
          <span>Commission Rate:</span>
          <span className="font-semibold">{commission.rate}%</span>
        </div>

        <div className="flex justify-between text-slate-300 mt-1">
          <span>Profit Generated:</span>
          <span className="font-semibold">
            ${commission.profit.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-300 mt-1">
          <span>Commission Earned:</span>
          <span className="font-semibold">
            ${commission.value.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-700 my-4"></div>

      {/* TOTAL PAY SECTION */}
      <div className="mb-4">
        <p className="text-slate-400 uppercase tracking-wider text-xs mb-2">
          Total Pay
        </p>

        <p className="text-3xl font-extrabold text-emerald-400">
          ${total_pay.toFixed(2)}
        </p>
      </div>

      {/* LAST PAID INFO */}
      {last_paid && (
        <div className="mt-6">
          <p className="text-slate-500 text-sm">
            Last Paid:{" "}
            <span className="text-slate-300 font-medium">
              {formatDate(last_paid)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
