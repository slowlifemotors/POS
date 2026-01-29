//app/customers/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import EditCustomerModal from "./components/EditCustomerModal";
import BlacklistModal from "./components/BlacklistModal";

type Customer = {
  id: number;
  name: string;
  phone: string;

  discount_id: number | null;
  voucher_amount: number;

  membership_active: boolean;
  membership_start: string | null;
  membership_end: string | null;

  is_blacklisted: boolean;
  blacklist_start: string | null;
  blacklist_end: string | null;
  blacklist_reason: string | null;
};

type Discount = {
  id: number;
  name: string;
  percent: number;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [blacklistModal, setBlacklistModal] = useState(false);
  const [blacklistCustomer, setBlacklistCustomer] = useState<Customer | null>(null);

  async function loadCustomers() {
    const res = await fetch("/api/customers", { cache: "no-store" });
    const json = await res.json();
    setCustomers(json.customers || []);
  }

  async function loadDiscounts() {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await res.json();
    setDiscounts(json.discounts || []);
  }

  useEffect(() => {
    loadCustomers();
    loadDiscounts();
  }, []);

  /* discount_id → "Name (X%)" */
  const discountLabelById = useMemo(() => {
    const map = new Map<number, string>();
    discounts.forEach((d) => {
      map.set(d.id, `${d.name} (${Number(d.percent ?? 0)}%)`);
    });
    return map;
  }, [discounts]);

  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(t) ||
      (c.phone || "").includes(search)
    );
  });

  function membershipText(c: Customer) {
    if (!c.membership_active) return "-";
    return `${c.membership_start ?? "?"} → ${c.membership_end ?? "?"}`;
  }

  function discountText(c: Customer) {
    if (!c.discount_id) return "No Discount";
    return discountLabelById.get(c.discount_id) ?? "Unknown Discount";
  }

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setShowModal(true);
          }}
          className="px-4 py-2 rounded-lg font-semibold
            bg-[color:var(--accent)]
            hover:bg-[color:var(--accent-hover)]"
        >
          + Add Customer
        </button>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        className="w-full mb-6 p-3 bg-slate-900 border border-slate-700 rounded"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Discount</th>
              <th className="p-3 text-left">Voucher</th>
              <th className="p-3 text-left">Membership</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="border-b border-slate-800">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.phone || "-"}</td>
                <td className="p-3">{discountText(c)}</td>
                <td className="p-3">${Number(c.voucher_amount ?? 0).toFixed(2)}</td>
                <td className="p-3">{membershipText(c)}</td>
                <td className="p-3">
                  {c.is_blacklisted ? (
                    <span className="text-red-400 font-bold">BLACKLISTED</span>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="p-3 text-right space-x-4">
                  <button
                    onClick={() => {
                      setEditingCustomer(c);
                      setShowModal(true);
                    }}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      setBlacklistCustomer(c);
                      setBlacklistModal(true);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Blacklist
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm("Delete this customer?")) return;
                      await fetch(`/api/customers?id=${c.id}`, { method: "DELETE" });
                      loadCustomers();
                    }}
                    className="text-red-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      {showModal && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSaved={loadCustomers}
        />
      )}

      {blacklistModal && blacklistCustomer && (
        <BlacklistModal
          customer={blacklistCustomer}
          onClose={() => setBlacklistModal(false)}
          onSaved={loadCustomers}
        />
      )}
    </div>
  );
}
