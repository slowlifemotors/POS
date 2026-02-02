// app/customers/components/EditCustomerModal.tsx

"use client";

import { useState, useEffect } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  discount_id: number | null;

  is_blacklisted: boolean;
  blacklist_reason: string | null;
  blacklist_start: string | null;
  blacklist_end: string | null;
};

type Discount = {
  id: number;
  name: string;
  percent: number;
};

export default function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [discountId, setDiscountId] = useState<number | null>(
    customer?.discount_id || null
  );

  // Blacklist fields
  const [isBlacklisted, setIsBlacklisted] = useState(
    customer?.is_blacklisted || false
  );
  const [reason, setReason] = useState(customer?.blacklist_reason || "");
  const [start, setStart] = useState(customer?.blacklist_start || "");
  const [end, setEnd] = useState(customer?.blacklist_end || "");

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [saving, setSaving] = useState(false);

  // Load discounts
  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts");
    const json = await res.json();
    setDiscounts(json.discounts || []);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const save = async () => {
    if (!name.trim()) {
      alert("Name cannot be empty.");
      return;
    }

    // Validate blacklist dates
    if (isBlacklisted) {
      if (!start || !end) {
        alert("Blacklist start and end dates are required.");
        return;
      }
      if (start > end) {
        alert("Blacklist start date must be before the end date.");
        return;
      }
    }

    setSaving(true);

    const res = await fetch("/api/customers/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer?.id,
        name,
        phone: phone || null,
        email: email || null,
        discount_id: discountId || null,

        // Blacklist fields
        is_blacklisted: isBlacklisted,
        blacklist_reason: isBlacklisted ? reason.trim() : null,
        blacklist_start: isBlacklisted ? start : null,
        blacklist_end: isBlacklisted ? end : null,
      }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(json.error || "Failed to update customer.");
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-40">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-110 text-slate-100">
        <h2 className="text-2xl font-bold mb-4">Edit Customer</h2>

        {/* BASIC INFO */}
        <input
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
          placeholder="Phone"
          value={phone || ""}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
          placeholder="Email"
          value={email || ""}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* DISCOUNT */}
        <select
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-4"
          value={discountId || ""}
          onChange={(e) =>
            setDiscountId(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">No Discount</option>
          {discounts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.percent}%
            </option>
          ))}
        </select>

        {/* BLACKLIST SECTION */}
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-800 mb-4">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isBlacklisted}
              onChange={(e) => setIsBlacklisted(e.target.checked)}
            />
            <span className="font-semibold text-red-400">
              Blacklist this Customer
            </span>
          </label>

          {isBlacklisted && (
            <>
              <textarea
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mb-3"
                placeholder="Reason for blacklist"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <label className="text-sm">Start Date</label>
              <input
                type="date"
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mb-3"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />

              <label className="text-sm">End Date</label>
              <input
                type="date"
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mb-3"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </>
          )}
        </div>

        {/* ACTIONS */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg mb-3"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
