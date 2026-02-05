// app/pos/components/AddCustomerModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { Customer, Discount } from "../hooks/usePOS";

type SearchResult =
  | ({
      type: "customer";
    } & Customer)
  | ({
      type: "staff";
      username?: string | null;
      discount_id: null;
      is_blacklisted: false;
      blacklist_reason: null;
      blacklist_start: null;
      blacklist_end: null;
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
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // ---------------------------------------------
  // Load all discounts
  // ---------------------------------------------
  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setDiscounts(Array.isArray(json.discounts) ? json.discounts : []);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  // ---------------------------------------------
  // Search Customers + Staff (via unified API)
  // ---------------------------------------------
  const searchPeople = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(search)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setResults(Array.isArray(json.results) ? json.results : []);
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
    const json = await res.json().catch(() => ({}));
    return (json.discount as Discount) || null;
  };

  // ---------------------------------------------
  // Create customer helper (manual creation only)
  // ---------------------------------------------
  const createCustomer = async (name: string, phone: string | null, discountId: number | null) => {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone?.trim() || null,
        discount_id: discountId ?? null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to create customer.");
    return json.customer as Customer;
  };

  // ---------------------------------------------------
  // Select existing customer OR staff
  // ---------------------------------------------------
  const selectResult = async (r: SearchResult) => {
    // Customer: normal
    if (r.type === "customer") {
      let discount: Discount | null = null;
      if (r.discount_id) discount = await loadDiscount(r.discount_id);

      onSelectCustomer(r, discount, "customer");
      onClose();
      return;
    }

    /**
     * ✅ Staff: DO NOT create a customer row.
     * We pass a "pseudo customer" object for UI purposes,
     * and the order payload will treat this as staff (no customer_id).
     */
    const pseudoCustomer: Customer = {
      // Use a negative ID to avoid accidental collision with real customer ids
      id: -Math.abs(Number(r.id)),
      name: r.name,
      phone: r.phone ?? null,
      discount_id: null,
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
    if (!newName.trim()) return;

    try {
      const created = await createCustomer(newName, newPhone || null, newDiscountId);

      let discountObj: Discount | null = null;
      if (created.discount_id) discountObj = await loadDiscount(created.discount_id);

      onSelectCustomer(created, discountObj, "customer");
      onClose();
    } catch (e: any) {
      alert(e?.message ?? "Failed to create customer.");
    }
  };

  // ---------------------------------------------
  // UI
  // ---------------------------------------------
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
                {results.map((r) => (
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

                    {r.type === "staff" && r.username && (
                      <p className="text-slate-400 text-xs">Username: {r.username}</p>
                    )}

                    {"is_blacklisted" in r && r.is_blacklisted && (
                      <p className="text-red-400 font-bold text-sm mt-1">⚠ Blacklisted</p>
                    )}
                  </div>
                ))}
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
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-4 text-slate-100"
            value={newDiscountId || ""}
            onChange={(e) => setNewDiscountId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No Discount</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.percent}%
              </option>
            ))}
          </select>

          <button
            onClick={saveNewCustomer}
            className="w-full bg-(--accent) hover:(--accent-hover) text-white py-2 rounded mb-2"
          >
            Save Customer
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
