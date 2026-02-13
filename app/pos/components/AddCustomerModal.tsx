// app/pos/components/AddCustomerModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { Customer, Discount } from "../hooks/usePOS";

type SearchResult =
  | ({
      type: "customer";
    } & Partial<Customer> &
      Pick<Customer, "id" | "name" | "phone" | "discount_id">)
  | ({
      type: "staff";
      username?: string | null;
      discount_id: null;
      is_blacklisted: false;
      blacklist_reason: null;
      blacklist_start: null;
      blacklist_end: null;
      membership_active: false;
      membership_start: null;
      membership_end: null;
      voucher_amount: 0;
      phone: string | null;
    } & Pick<Customer, "id" | "name" | "phone">);

export type SelectedCustomerType = "customer" | "staff";

export default function AddCustomerModal({
  onClose,
  onSelectCustomer,
}: {
  onClose: () => void;
  onSelectCustomer: (
    customer: Customer,
    discount: Discount | null,
    customerType: SelectedCustomerType
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDiscountId, setNewDiscountId] = useState<number | null>(null);

  const [newVoucherAmount, setNewVoucherAmount] = useState<number>(0);

  const [newMembershipActive, setNewMembershipActive] = useState<boolean>(false);
  const [newMembershipStart, setNewMembershipStart] = useState<string>("");
  const [newMembershipEnd, setNewMembershipEnd] = useState<string>("");

  const [discounts, setDiscounts] = useState<Discount[]>([]);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  // ---------------------------------------------
  // Load all discounts
  // ---------------------------------------------
  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await safeJson(res);
    setDiscounts(Array.isArray(json.discounts) ? (json.discounts as Discount[]) : []);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  // ---------------------------------------------
  // Search Customers + Staff (via unified API)
  // ---------------------------------------------
  const searchPeople = async () => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const json = await safeJson(res);

      const arr =
        (Array.isArray(json.results) && json.results) ||
        (Array.isArray(json.customers) && json.customers) ||
        [];

      setResults(arr as SearchResult[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => searchPeople(), 300);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ---------------------------------------------
  // Load specific discount
  // ---------------------------------------------
  const loadDiscount = async (discountId: number): Promise<Discount | null> => {
    const res = await fetch(`/api/discounts?id=${discountId}`, { cache: "no-store" });
    const json = await safeJson(res);
    return (json.discount as Discount) || null;
  };

  // ---------------------------------------------
  // Load full customer record by id
  // ---------------------------------------------
  const loadCustomerById = async (id: number): Promise<Customer> => {
    const res = await fetch(`/api/customers?id=${id}`, { cache: "no-store" });
    const json = await safeJson(res);

    if (!res.ok) throw new Error(json?.error || "Failed to load customer.");
    if (!json?.customer) throw new Error("Customer API did not return { customer }.");

    return json.customer as Customer;
  };

  // ---------------------------------------------
  // Create customer helper (manual creation only)
  // ---------------------------------------------
  const createCustomer = async () => {
    const name = newName.trim();
    if (!name) throw new Error("Name is required.");

    // Membership validation
    if (newMembershipActive) {
      const s = newMembershipStart.trim();
      const e = newMembershipEnd.trim();
      if ((s && !e) || (!s && e)) {
        throw new Error("If membership is active, provide BOTH start and end dates (or leave both blank).");
      }
      if (s && e && s > e) {
        throw new Error("Membership start date must be before or equal to end date.");
      }
    }

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: newPhone.trim() ? newPhone.trim() : null,
        discount_id: newDiscountId ?? null,
        voucher_amount: Number.isFinite(Number(newVoucherAmount)) ? Number(newVoucherAmount) : 0,

        membership_active: Boolean(newMembershipActive),
        membership_start: newMembershipStart.trim() ? newMembershipStart.trim() : null,
        membership_end: newMembershipEnd.trim() ? newMembershipEnd.trim() : null,
      }),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || "Failed to create customer.");
    if (!json?.customer) throw new Error("Customer API did not return { customer }.");

    return json.customer as Customer;
  };

  // ---------------------------------------------------
  // Select existing customer OR staff
  // ---------------------------------------------------
  const selectResult = async (r: SearchResult) => {
    if (r.type === "customer") {
      try {
        const id = Number(r.id);
        const customer = await loadCustomerById(id);

        let discount: Discount | null = null;
        if (customer.discount_id) discount = await loadDiscount(customer.discount_id);

        onSelectCustomer(customer, discount, "customer");
        onClose();
        return;
      } catch (e: any) {
        alert(e?.message ?? "Failed to load customer.");
        return;
      }
    }

    const pseudoCustomer: Customer = {
      id: -Math.abs(Number(r.id)),
      name: String(r.name ?? ""),
      phone: r.phone ?? null,
      discount_id: null,

      voucher_amount: 0,

      membership_active: false,
      membership_start: null,
      membership_end: null,

      is_blacklisted: false,
      blacklist_reason: null,
      blacklist_start: null,
      blacklist_end: null,
    };

    onSelectCustomer(pseudoCustomer, null, "staff");
    onClose();
  };

  // ---------------------------------------------
  // Create new customer (manual)
  // ---------------------------------------------
  const saveNewCustomer = async () => {
    try {
      const created = await createCustomer();

      let discountObj: Discount | null = null;
      if (created.discount_id) discountObj = await loadDiscount(created.discount_id);

      onSelectCustomer(created, discountObj, "customer");
      onClose();
    } catch (e: any) {
      alert(e?.message ?? "Failed to create customer.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 w-105 p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
        <h2 className="text-2xl font-bold mb-4">Add / Select Customer</h2>

        {/* SEARCH INPUT */}
        <input
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-4"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* SEARCH RESULTS */}
        {loading ? (
          <p className="text-slate-400 text-sm mb-3">Searching...</p>
        ) : (
          <>
            {results.length > 0 && (
              <div className="max-h-40 overflow-y-auto mb-4 space-y-2">
                {results.map((r) => {
                  const isBlacklisted = r.type === "customer" ? Boolean((r as any).is_blacklisted) : false;

                  return (
                    <div
                      key={`${r.type}-${r.id}`}
                      className="p-3 bg-slate-800 border border-slate-700 rounded cursor-pointer hover:bg-slate-700"
                      onClick={() => selectResult(r)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{r.name}</p>

                        {r.type === "staff" && (
                          <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
                            Staff
                          </span>
                        )}
                      </div>

                      {"phone" in r && r.phone && <p className="text-slate-400">{r.phone}</p>}

                      {r.type === "staff" && (r as any).username && (
                        <p className="text-slate-400 text-xs">Username: {(r as any).username}</p>
                      )}

                      {r.type === "customer" && isBlacklisted && (
                        <p className="text-red-400 font-bold text-sm mt-1">⚠ Blacklisted</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* CREATE NEW CUSTOMER */}
        <div className="border-t border-slate-700 pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-2">Or Create New</h3>

          <input
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-2"
            placeholder="Full Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <input
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-2"
            placeholder="Phone"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />

          <select
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-2 text-slate-100"
            value={newDiscountId ?? ""}
            onChange={(e) => setNewDiscountId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No Discount</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.percent}%
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.01"
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
            placeholder="Voucher Amount (e.g. 50)"
            value={String(newVoucherAmount)}
            onChange={(e) => setNewVoucherAmount(Number(e.target.value))}
          />

          {/* MEMBERSHIP */}
          <div className="bg-slate-800/40 border border-slate-700 rounded p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Membership</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newMembershipActive}
                  onChange={(e) => setNewMembershipActive(e.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block mb-1 text-xs text-slate-300">Start</label>
                <input
                  type="date"
                  className="w-full p-2 rounded bg-slate-900 border border-slate-700"
                  value={newMembershipStart}
                  onChange={(e) => setNewMembershipStart(e.target.value)}
                  disabled={!newMembershipActive}
                />
              </div>

              <div>
                <label className="block mb-1 text-xs text-slate-300">End</label>
                <input
                  type="date"
                  className="w-full p-2 rounded bg-slate-900 border border-slate-700"
                  value={newMembershipEnd}
                  onChange={(e) => setNewMembershipEnd(e.target.value)}
                  disabled={!newMembershipActive}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Leave dates blank for open-ended membership.
            </p>
          </div>

          <button
            onClick={saveNewCustomer}
            className="w-full bg-(--accent) hover:bg-(--accent-hover) text-white py-2 rounded mb-2"
            type="button"
          >
            Save Customer
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-2 rounded"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
