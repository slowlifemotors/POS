// app/pos/components/AddCustomerModal.tsx
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

export default function AddCustomerModal({
  onClose,
  onSelectCustomer,
}: {
  onClose: () => void;
  onSelectCustomer: (customer: Customer, discount: Discount | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDiscountId, setNewDiscountId] = useState<number | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // ---------------------------------------------
  // Load all discounts
  // ---------------------------------------------
  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts");
    const json = await res.json();
    setDiscounts(json.discounts || []);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  // ---------------------------------------------
  // Search Customers (returns blacklist fields now)
  // ---------------------------------------------
  const searchCustomers = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/customers/search?q=${encodeURIComponent(search)}`);
    const json = await res.json();

    setResults(json.customers ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const delay = setTimeout(() => searchCustomers(), 300);
    return () => clearTimeout(delay);
  }, [search]);

  // ---------------------------------------------
  // Load specific discount
  // ---------------------------------------------
  const loadDiscount = async (discountId: number): Promise<Discount | null> => {
    const res = await fetch(`/api/discounts?id=${discountId}`);
    const json = await res.json();
    return json.discount || null;
  };

  // ---------------------------------------------------
// Select existing customer  (PATCHED VERSION)
// ---------------------------------------------------
const selectCustomer = async (customer: Customer) => {
  let discount: Discount | null = null;

  if (customer.discount_id) {
    discount = await loadDiscount(customer.discount_id);
  }

  // 🔥 FULL customer object returned, including blacklist fields
  onSelectCustomer(
    {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? null,
      discount_id: customer.discount_id,

      // BLACKLIST FIELDS
      is_blacklisted: customer.is_blacklisted ?? false,
      blacklist_reason: customer.blacklist_reason ?? null,
      blacklist_start: customer.blacklist_start ?? null,
      blacklist_end: customer.blacklist_end ?? null,
    },
    discount
  );

  onClose();
};


  // ---------------------------------------------
  // Create new customer WITH blacklist fields defaulted
  // ---------------------------------------------
  const saveNewCustomer = async () => {
    if (!newName.trim()) return;

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        phone: newPhone.trim() || null,
        discount_id: newDiscountId || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) return;

    const created: Customer = {
      ...json.customer,
      is_blacklisted: false,
      blacklist_reason: null,
      blacklist_start: null,
      blacklist_end: null,
    };

    let discountObj: Discount | null = null;

    if (created.discount_id) {
      discountObj = await loadDiscount(created.discount_id);
    }

    onSelectCustomer(created, discountObj);
    onClose();
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
                {results.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-800 border border-slate-700 rounded cursor-pointer hover:bg-slate-700"
                    onClick={() => selectCustomer(c)}
                  >
                    <p className="font-semibold">{c.name}</p>
                    {c.phone && <p className="text-slate-400">{c.phone}</p>}

                    {c.is_blacklisted && (
                      <p className="text-red-400 font-bold text-sm mt-1">
                        ⚠ Blacklisted
                      </p>
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
            onChange={(e) =>
              setNewDiscountId(e.target.value ? Number(e.target.value) : null)
            }
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
