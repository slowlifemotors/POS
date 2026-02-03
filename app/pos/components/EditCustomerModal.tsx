// app/pos/components/AddCustomerModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { Customer, Discount } from "../hooks/usePOS";

type DiscountOption = {
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
  const [discounts, setDiscounts] = useState<DiscountOption[]>([]);

  const [searchError, setSearchError] = useState<string | null>(null);

  // ---------------------------------------------
  // Load all discounts
  // ---------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/discounts", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        setDiscounts(Array.isArray(json.discounts) ? json.discounts : []);
      } catch {
        setDiscounts([]);
      }
    })();
  }, []);

  // ---------------------------------------------
  // Search customers
  // ---------------------------------------------
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = search.trim();
      if (!q) {
        setResults([]);
        setSearchError(null);
        return;
      }

      setLoading(true);
      setSearchError(null);

      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setResults([]);
          setSearchError(json?.error || "Search failed.");
          return;
        }

        setResults(Array.isArray(json.customers) ? json.customers : []);
      } catch {
        setResults([]);
        setSearchError("Search failed.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
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
  // Select existing customer
  // ---------------------------------------------
  const selectCustomer = async (customer: Customer) => {
    let discount: Discount | null = null;

    if (customer.discount_id) {
      discount = await loadDiscount(customer.discount_id);
    }

    onSelectCustomer(customer, discount);
    onClose();
  };

  // ---------------------------------------------
  // Create new customer
  // NOTE: your /api/customers POST currently returns {success:true}
  // so we re-search after creation to get the created row.
  // ---------------------------------------------
  const saveNewCustomer = async () => {
    const name = newName.trim();
    if (!name) return;

    const phone = newPhone.trim() || null;

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        discount_id: newDiscountId || null,
      }),
    });

    if (!res.ok) {
      alert("Failed to create customer.");
      return;
    }

    // Re-fetch the created customer by searching phone (best) or name
    const lookupQ = phone ?? name;
    const sres = await fetch(`/api/customers/search?q=${encodeURIComponent(lookupQ)}`, {
      cache: "no-store",
    });
    const sjson = await sres.json().catch(() => ({}));

    const found = Array.isArray(sjson.customers) ? (sjson.customers[0] as Customer) : null;
    if (!found) {
      alert("Customer created, but could not load it. Try searching again.");
      onClose();
      return;
    }

    let discountObj: Discount | null = null;
    if (found.discount_id) discountObj = await loadDiscount(found.discount_id);

    onSelectCustomer(found, discountObj);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 w-105 p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
        <h2 className="text-2xl font-bold mb-4">Add / Select Customer</h2>

        <input
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 mb-3"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading && <p className="text-slate-400 text-sm mb-3">Searching...</p>}

        {!loading && searchError && (
          <p className="text-red-400 text-sm mb-3">{searchError}</p>
        )}

        {!loading && !searchError && results.length > 0 && (
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
                  <p className="text-red-400 font-bold text-sm mt-1">⚠ Blacklisted</p>
                )}
              </div>
            ))}
          </div>
        )}

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

          <button
            onClick={saveNewCustomer}
            className="w-full bg-(--accent) hover:bg-(--accent-hover) text-white py-2 rounded mb-2"
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
