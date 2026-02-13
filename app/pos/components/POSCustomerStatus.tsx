// app/pos/components/POSCustomerStatus.tsx
"use client";

import React, { useMemo } from "react";
import type { Customer, Discount, SelectedCustomerType } from "../hooks/usePOS";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function isMemberActive(c: Customer | null) {
  if (!c) return false;
  if (!c.membership_active) return false;

  const s = c.membership_start;
  const e = c.membership_end;

  // Open-ended membership if dates missing
  if (!s || !e) return true;

  const t = todayYMD();
  return s <= t && t <= e;
}

export default function POSCustomerStatus({
  customer,
  discount,
  isBlacklisted,
  customerType,
}: {
  customer: Customer | null;
  discount: Discount | null;
  isBlacklisted: boolean;
  customerType: SelectedCustomerType;
}) {
  const member = useMemo(() => isMemberActive(customerType === "customer" ? customer : null), [customer, customerType]);

  if (!customer) {
    return (
      <div className="mb-4 p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Customer</h3>
        <p className="text-slate-400 text-sm">No customer selected.</p>
      </div>
    );
  }

  const voucher = Number(customerType === "customer" ? (customer.voucher_amount ?? 0) : 0);

  return (
    <div className="mb-4 p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Customer</h3>
          <p className="text-lg font-bold">{customer.name}</p>
          {customer.phone ? <p className="text-slate-400 text-sm">{customer.phone}</p> : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {customerType === "staff" ? (
            <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
              Staff Sale
            </span>
          ) : null}

          {customerType === "customer" && member ? (
            <span className="text-xs px-2 py-1 rounded bg-emerald-700/60 border border-emerald-600 text-emerald-100">
              MEMBER (10% OFF)
            </span>
          ) : null}

          {customerType === "customer" ? (
            <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
              Voucher: ${voucher.toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Discount</span>
          <span className="text-slate-100 font-semibold">
            {customerType === "staff"
              ? "Staff pricing (25% off)"
              : discount
              ? `${discount.name} (${discount.percent}%)`
              : member
              ? "Membership (10%)"
              : "None"}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span>Status</span>
          <span className={`font-semibold ${isBlacklisted ? "text-red-400" : "text-slate-200"}`}>
            {isBlacklisted && customerType === "customer" ? "BLACKLISTED (x2)" : "OK"}
          </span>
        </div>
      </div>
    </div>
  );
}
