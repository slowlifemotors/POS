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

  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  blacklist_start?: string | null;
  blacklist_end?: string | null;
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

function toNullIfBlank(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export default function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: EditCustomerModalProps) {
  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [discountId, setDiscountId] = useState<number | null>(
    customer?.discount_id ?? null
  );

  const [voucherAmount, setVoucherAmount] = useState<number>(
    toMoneyNumber(customer?.voucher_amount ?? 0)
  );

  const [membershipActive, setMembershipActive] = useState<boolean>(
    Boolean(customer?.membership_active ?? false)
  );
  const [membershipStart, setMembershipStart] = useState<string>(
    customer?.membership_start ?? ""
  );
  const [membershipEnd, setMembershipEnd] = useState<string>(
    customer?.membership_end ?? ""
  );

  const [note, setNote] = useState<string>(customer?.note ?? "");

  const [isBlacklisted, setIsBlacklisted] = useState<boolean>(
    Boolean(customer?.is_blacklisted ?? false)
  );
  const [blacklistReason, setBlacklistReason] = useState<string>(
    customer?.blacklist_reason ?? ""
  );
  const [blacklistStart, setBlacklistStart] = useState<string>(
    customer?.blacklist_start ?? ""
  );
  const [blacklistEnd, setBlacklistEnd] = useState<string>(
    customer?.blacklist_end ?? ""
  );

  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [callerRole, setCallerRole] = useState<string>("staff");

  useEffect(() => {
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setDiscountId(customer?.discount_id ?? null);

    setVoucherAmount(toMoneyNumber(customer?.voucher_amount ?? 0));

    setMembershipActive(Boolean(customer?.membership_active ?? false));
    setMembershipStart(customer?.membership_start ?? "");
    setMembershipEnd(customer?.membership_end ?? "");

    setNote(customer?.note ?? "");

    setIsBlacklisted(Boolean(customer?.is_blacklisted ?? false));
    setBlacklistReason(customer?.blacklist_reason ?? "");
    setBlacklistStart(customer?.blacklist_start ?? "");
    setBlacklistEnd(customer?.blacklist_end ?? "");
  }, [customer]);

  const canModifyDiscount = useMemo(() => {
    return callerRole === "admin" || callerRole === "owner";
  }, [callerRole]);

  useEffect(() => {
    async function loadCaller() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await safeJson(res);
      if (json?.staff?.role) setCallerRole(String(json.staff.role).toLowerCase());
    }
    loadCaller();
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/discounts", { cache: "no-store" });
      const json = await safeJson(res);
      setDiscounts(Array.isArray(json.discounts) ? json.discounts : []);
    }
    load();
  }, []);

  async function save() {
    if (!name.trim()) {
      alert("Customer name is required.");
      return;
    }

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

    if (isBlacklisted) {
      if (!blacklistReason.trim()) {
        alert("Please provide a blacklist reason.");
        return;
      }
      if (!blacklistStart || !blacklistEnd) {
        alert("Please provide blacklist start and end dates.");
        return;
      }
      if (blacklistEnd < blacklistStart) {
        alert("Blacklist end date cannot be before start date.");
        return;
      }
    }

    const voucher = toMoneyNumber(voucherAmount);
    if (voucher < 0) {
      alert("Voucher amount cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      const body: any = {
        id: customer?.id,
        name: name.trim(),
        phone: toNullIfBlank(phone),

        voucher_amount: voucher,

        membership_active: membershipActive,
        membership_start: membershipActive ? membershipStart : null,
        membership_end: membershipActive ? membershipEnd : null,

        note: toNullIfBlank(note),

        is_blacklisted: isBlacklisted,
        blacklist_reason: isBlacklisted ? blacklistReason.trim() : null,
        blacklist_start: isBlacklisted ? blacklistStart : null,
        blacklist_end: isBlacklisted ? blacklistEnd : null,
      };

      if (canModifyDiscount) body.discount_id = discountId;

      let res: Response;

      if (isEdit) {
        res = await fetch("/api/customers/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const json = await safeJson(res);

      if (!res.ok) {
        console.error("Customer save error:", json);
        alert(json?.error || "Failed to save customer.");
        return;
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

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

          <div>
            <label className="block mb-1 text-sm text-slate-300">
              Voucher Balance ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
              value={Number.isFinite(voucherAmount) ? voucherAmount : 0}
              onChange={(e) => setVoucherAmount(toMoneyNumber(e.target.value))}
            />
          </div>

          <div className="border border-slate-700 rounded p-3 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200">
                Membership
              </label>
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

          <div className="border border-slate-700 rounded p-3 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200">Blacklist</label>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isBlacklisted}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setIsBlacklisted(v);
                    if (!v) {
                      setBlacklistReason("");
                      setBlacklistStart("");
                      setBlacklistEnd("");
                    }
                  }}
                />
                {isBlacklisted ? "Blacklisted" : "Not blacklisted"}
              </label>
            </div>

            {isBlacklisted ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">Reason</label>
                  <textarea
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                    rows={3}
                    placeholder="Reason..."
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs text-slate-400">Start</label>
                    <input
                      type="date"
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                      value={blacklistStart}
                      onChange={(e) => setBlacklistStart(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-xs text-slate-400">End</label>
                    <input
                      type="date"
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                      value={blacklistEnd}
                      onChange={(e) => setBlacklistEnd(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Turn this off to remove the blacklist (it will clear reason/dates on save).
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Toggle on to blacklist, or toggle off to remove an existing blacklist.
              </p>
            )}
          </div>

          <select
            disabled={!canModifyDiscount}
            className={`w-full bg-slate-800 border border-slate-700 p-2 rounded ${
              !canModifyDiscount ? "opacity-50 cursor-not-allowed" : ""
            }`}
            value={discountId ?? ""}
            onChange={(e) =>
              setDiscountId(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">No Discount</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.percent}%)
              </option>
            ))}
          </select>

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
