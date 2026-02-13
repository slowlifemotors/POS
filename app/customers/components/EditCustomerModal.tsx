// app/customers/components/EditCustomerModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export interface CustomerRecord {
  id: number;
  name: string;
  phone: string | null;
  discount_id: number | null;

  voucher_amount?: number;

  membership_active?: boolean;
  membership_start?: string | null;
  membership_end?: string | null;

  note?: string | null;
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

function toMoneyNumber(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
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
  const [discountId, setDiscountId] = useState<number | null>(customer?.discount_id ?? null);

  const [voucherAmount, setVoucherAmount] = useState<number>(
    toMoneyNumber(customer?.voucher_amount ?? 0)
  );

  const [membershipActive, setMembershipActive] = useState<boolean>(
    Boolean(customer?.membership_active ?? false)
  );
  const [membershipStart, setMembershipStart] = useState<string>(customer?.membership_start ?? "");
  const [membershipEnd, setMembershipEnd] = useState<string>(customer?.membership_end ?? "");

  const [note, setNote] = useState<string>(customer?.note ?? "");

  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Who is editing?
  const [callerRole, setCallerRole] = useState<string>("staff");

  // ---------------------------------------------------------
  // Keep state in sync when switching customers
  // ---------------------------------------------------------
  useEffect(() => {
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setDiscountId(customer?.discount_id ?? null);

    setVoucherAmount(toMoneyNumber(customer?.voucher_amount ?? 0));

    setMembershipActive(Boolean(customer?.membership_active ?? false));
    setMembershipStart(customer?.membership_start ?? "");
    setMembershipEnd(customer?.membership_end ?? "");

    setNote(customer?.note ?? "");
  }, [customer]);

  const canModifyDiscount = useMemo(() => {
    return callerRole === "admin" || callerRole === "owner";
  }, [callerRole]);

  // ---------------------------------------------------------
  // LOAD CALLER (admin & owner can modify discounts)
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadCaller() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (json?.staff?.role) {
        setCallerRole(String(json.staff.role).toLowerCase());
      }
    }
    loadCaller();
  }, []);

  // ---------------------------------------------------------
  // LOAD DISCOUNTS
  // ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/discounts", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setDiscounts(Array.isArray(json.discounts) ? json.discounts : []);
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

    // Basic validation for membership
    if (membershipActive) {
      if (!membershipStart || !membershipEnd) {
        alert("Please provide membership start and end dates.");
        return;
      }
      if (membershipEnd < membershipStart) {
        alert("Membership end date cannot be before start date.");
        return;
      }
    }

    const voucher = toMoneyNumber(voucherAmount);
    if (voucher < 0) {
      alert("Voucher amount cannot be negative.");
      return;
    }

    setSaving(true);

    const body: any = {
      id: customer?.id,
      name: name.trim(),
      phone: phone?.trim() ? phone.trim() : null,

      voucher_amount: voucher,

      membership_active: membershipActive,
      membership_start: membershipActive ? membershipStart : null,
      membership_end: membershipActive ? membershipEnd : null,

      note: note?.trim() ? note.trim() : null,
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
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-105 text-slate-100 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">
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

          {/* Voucher */}
          <div>
            <label className="block mb-1 text-sm text-slate-300">Voucher Balance ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
              value={Number.isFinite(voucherAmount) ? voucherAmount : 0}
              onChange={(e) => setVoucherAmount(toMoneyNumber(e.target.value))}
            />
          </div>

          {/* Membership */}
          <div className="border border-slate-700 rounded p-3 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200">Membership</label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={membershipActive}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setMembershipActive(v);
                    if (!v) {
                      setMembershipStart("");
                      setMembershipEnd("");
                    }
                  }}
                />
                Active
              </label>
            </div>

            {membershipActive && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">Start</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                    value={membershipStart}
                    onChange={(e) => setMembershipStart(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs text-slate-400">End</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                    value={membershipEnd}
                    onChange={(e) => setMembershipEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!membershipActive && (
              <p className="mt-2 text-xs text-slate-400">
                Turn this on and set dates to mark the customer as a member.
              </p>
            )}
          </div>

          {/* Discount Dropdown — only owner/admin can use */}
          <select
            disabled={!canModifyDiscount}
            className={`w-full bg-slate-800 border border-slate-700 p-2 rounded ${
              !canModifyDiscount ? "opacity-50 cursor-not-allowed" : ""
            }`}
            value={discountId ?? ""}
            onChange={(e) => setDiscountId(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">No Discount</option>

            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.percent}%)
              </option>
            ))}
          </select>

          {/* Notes */}
          <div>
            <label className="block mb-1 text-sm text-slate-300">Notes</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
              rows={4}
              placeholder="Customer notes (visible to staff)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50"
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-(--accent) hover:bg-(--accent-hover) rounded text-white disabled:opacity-50"
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
