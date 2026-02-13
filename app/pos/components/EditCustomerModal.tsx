// app/pos/components/EditCustomerModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, Discount } from "../hooks/usePOS";

type DiscountOption = {
  id: number;
  name: string;
  percent: number;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function EditCustomerModal({
  customer,
  onClose,
  onSelectCustomer,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSelectCustomer: (customer: Customer, disc: Discount | null, customerType?: "customer") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [discountId, setDiscountId] = useState<number | null>(null);

  // Membership fields
  const [membershipActive, setMembershipActive] = useState(false);
  const [membershipStart, setMembershipStart] = useState<string>("");
  const [membershipEnd, setMembershipEnd] = useState<string>("");

  // Voucher
  const [voucherAmount, setVoucherAmount] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);

  const customerId = customer?.id ?? null;

  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await safeJson(res);
    const arr = Array.isArray(json.discounts) ? json.discounts : [];
    setDiscounts(arr as DiscountOption[]);
  };

  const loadCustomerById = async (id: number): Promise<Customer> => {
    const res = await fetch(`/api/customers?id=${id}`, { cache: "no-store" });
    const json = await safeJson(res);

    if (!res.ok) throw new Error(json?.error || "Failed to load customer.");
    if (!json?.customer) throw new Error("Customer API did not return { customer }.");

    return json.customer as Customer;
  };

  const hydrateForm = (c: any) => {
    setName(String(c?.name ?? ""));
    setPhone(String(c?.phone ?? ""));

    setDiscountId(c?.discount_id != null ? Number(c.discount_id) : null);

    setMembershipActive(Boolean(c?.membership_active));
    setMembershipStart(c?.membership_start ? String(c.membership_start).slice(0, 10) : "");
    setMembershipEnd(c?.membership_end ? String(c.membership_end).slice(0, 10) : "");

    setVoucherAmount(Number(c?.voucher_amount ?? 0));
  };

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);

      try {
        await loadDiscounts();

        if (!customerId || customerId <= 0) {
          setLoading(false);
          return;
        }

        // Always fetch fresh so membership/voucher are accurate
        const fresh = await loadCustomerById(customerId);
        hydrateForm(fresh);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const selectedDiscountObj = useMemo(() => {
    if (!discountId) return null;
    return discounts.find((d) => d.id === discountId) ?? null;
  }, [discountId, discounts]);

  const loadDiscount = async (id: number): Promise<Discount | null> => {
    const res = await fetch(`/api/discounts?id=${id}`, { cache: "no-store" });
    const json = await safeJson(res);
    return (json.discount as Discount) || null;
  };

  const save = async () => {
    if (!customerId || customerId <= 0) {
      alert("No customer selected.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("Name is required.");
      return;
    }

    if (membershipActive) {
      if (!membershipStart || !membershipEnd) {
        alert("Membership start and end dates are required when membership is active.");
        return;
      }
      if (membershipEnd < membershipStart) {
        alert("Membership end date cannot be before start date.");
        return;
      }
    }

    const voucher = Number(voucherAmount);
    if (!Number.isFinite(voucher) || voucher < 0) {
      alert("Voucher amount must be 0 or greater.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: customerId,
          name: trimmedName,
          phone: phone.trim() ? phone.trim() : null,
          discount_id: discountId ?? null,

          membership_active: membershipActive,
          membership_start: membershipActive ? membershipStart : null,
          membership_end: membershipActive ? membershipEnd : null,

          voucher_amount: voucher,
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to update customer.");

      // Reload updated customer
      const updated = await loadCustomerById(customerId);

      // Reload discount object (if set)
      let disc: Discount | null = null;
      if (updated.discount_id) {
        disc = await loadDiscount(updated.discount_id);
      }

      onSelectCustomer(updated, disc, "customer");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 w-105 p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">Edit Customer</h2>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
            type="button"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : !customerId || customerId <= 0 ? (
          <div className="text-slate-300">
            <p className="text-red-300 font-semibold mb-2">No real customer selected.</p>
            <p className="text-sm text-slate-400">
              Select a customer (not staff sale), then open Edit Customer.
            </p>

            <div className="mt-5">
              <button
                onClick={onClose}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-2 rounded"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded border border-red-700/50 bg-red-900/20 p-3 text-red-200">
                {error}
              </div>
            )}

            {/* Name */}
            <label className="block text-slate-300 mb-1">Name</label>
            <input
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />

            {/* Phone */}
            <label className="block text-slate-300 mb-1">Phone</label>
            <input
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
            />

            {/* Discount */}
            <label className="block text-slate-300 mb-1">Discount</label>
            <select
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-2 text-slate-100"
              value={discountId ?? ""}
              onChange={(e) => setDiscountId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No Discount</option>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.percent}%
                </option>
              ))}
            </select>

            {selectedDiscountObj && (
              <div className="text-xs text-slate-400 mb-4">
                Selected: {selectedDiscountObj.name} ({selectedDiscountObj.percent}%)
              </div>
            )}

            {/* Membership */}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Membership</h3>
                <label className="flex items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={membershipActive}
                    onChange={(e) => setMembershipActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Start</label>
                  <input
                    type="date"
                    className="w-full p-2 rounded bg-slate-800 border border-slate-700"
                    value={membershipStart}
                    onChange={(e) => setMembershipStart(e.target.value)}
                    disabled={!membershipActive}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">End</label>
                  <input
                    type="date"
                    className="w-full p-2 rounded bg-slate-800 border border-slate-700"
                    value={membershipEnd}
                    onChange={(e) => setMembershipEnd(e.target.value)}
                    disabled={!membershipActive}
                  />
                </div>
              </div>

              {!membershipActive && (
                <div className="text-xs text-slate-400 mt-2">
                  When inactive, start/end dates will be cleared.
                </div>
              )}
            </div>

            {/* Voucher */}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3">Voucher Balance</h3>

              <label className="block text-slate-300 mb-1">Voucher Amount ($)</label>
              <input
                type="number"
                className="w-full p-2 rounded bg-slate-800 border border-slate-700"
                value={Number.isFinite(voucherAmount) ? voucherAmount : 0}
                onChange={(e) => setVoucherAmount(Number(e.target.value))}
                min={0}
                step="0.01"
              />

              <div className="text-xs text-slate-400 mt-2">
                This is the customer’s available voucher balance used at checkout.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={save}
                disabled={saving}
                className={`flex-1 py-2 rounded font-semibold ${
                  saving
                    ? "bg-slate-700 text-slate-400"
                    : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                }`}
                type="button"
              >
                {saving ? "Saving..." : "Save"}
              </button>

              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                type="button"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
