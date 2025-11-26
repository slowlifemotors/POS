//  app/customers/components/EditCustomerModal.tsx
"use client";

import { useEffect, useState } from "react";

export interface CustomerRecord {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  discount_id: number | null;
}

export interface DiscountOption {
  id: number;
  name: string;
  percent: number;
}

interface EditCustomerModalProps {
  customer: CustomerRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: EditCustomerModalProps) {
  const isEdit = !!customer;

  // ---------------------------------------------------------
  // LOCAL STATE
  // ---------------------------------------------------------
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [discountId, setDiscountId] = useState<number | null>(
    customer?.discount_id ?? null
  );

  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Who is editing?
  const [callerRole, setCallerRole] = useState<string>("staff");

  // ---------------------------------------------------------
  // LOAD CALLER (admin & owner can modify discounts)
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadCaller() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await res.json();

      if (json?.staff?.role) {
        setCallerRole(json.staff.role.toLowerCase());
      }
    }
    loadCaller();
  }, []);

  const canModifyDiscount =
    callerRole === "admin" || callerRole === "owner";

  // ---------------------------------------------------------
  // LOAD DISCOUNTS
  // ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/discounts", { cache: "no-store" });
      const json = await res.json();
      setDiscounts(json.discounts || []);
    }
    load();
  }, []);

  // ---------------------------------------------------------
  // SAVE CUSTOMER
  // ---------------------------------------------------------
  async function save() {
    if (!name.trim()) {
      alert("Customer name is required.");
      return;
    }

    setSaving(true);

    const body: any = {
      id: customer?.id,
      name,
      phone,
      email,
    };

    if (canModifyDiscount) {
      body.discount_id = discountId;
    }

    const method = isEdit ? "PUT" : "POST";

    const res = await fetch("/api/customers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Customer save error:", await res.text());
      alert("Failed to save customer.");
      setSaving(false);
      return;
    }

    onSaved();
    onClose();
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 text-slate-100 shadow-xl">
        <h2 className="text-2xl font-bold text-fuchsia-500 mb-4">
          {isEdit ? "Edit Customer" : "Add Customer"}
        </h2>

        <div className="space-y-3">
          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            placeholder="Phone"
            value={phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            placeholder="Email"
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Discount Dropdown — only owner/admin can use */}
          <select
            disabled={!canModifyDiscount}
            className={`w-full bg-slate-800 border border-slate-700 p-2 rounded ${
              !canModifyDiscount ? "opacity-50 cursor-not-allowed" : ""
            }`}
            value={discountId ?? ""}
            onChange={(e) =>
              setDiscountId(
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          >
            <option value="">No Discount</option>

            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.percent}%)
              </option>
            ))}
          </select>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 rounded text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
