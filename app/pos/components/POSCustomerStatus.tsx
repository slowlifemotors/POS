// app/pos/components/POSCustomerStatus.tsx
"use client";

import type { Customer, Discount, SelectedCustomerType } from "../hooks/usePOS";

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
  return (
    <div className="mb-4 p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-300 mb-1">Customer</h2>

      {!customer && <p className="text-slate-400 text-sm">No customer selected.</p>}

      {customer && (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-50">{customer.name}</p>

            {customerType === "staff" && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                Staff
              </span>
            )}
          </div>

          {customer.phone && <p className="text-slate-300 text-xs">📞 {customer.phone}</p>}
        </div>
      )}

      {discount && <p className="text-amber-400">Discount: {discount.percent}% OFF</p>}

      {isBlacklisted && (
        <p className="mt-2 text-red-400 font-bold">⚠️ This customer is currently blacklisted</p>
      )}

      {customerType === "staff" && (
        <p className="mt-2 text-xs text-slate-400">
          Staff sale — commission will be forced to $0.
        </p>
      )}
    </div>
  );
}
