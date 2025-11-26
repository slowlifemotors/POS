//  app/customers/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import EditCustomerModal from "./components/EditCustomerModal";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  discount_id: number | null;
};

type Discount = {
  id: number;
  name: string;
  percent: number;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");

  const [discounts, setDiscounts] = useState<Discount[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // -------------------------------------------------------
  // LOAD CUSTOMERS
  // -------------------------------------------------------
  const loadCustomers = async () => {
    const res = await fetch("/api/customers", { cache: "no-store" });
    const json = await res.json();
    setCustomers(json.customers || []);
  };

  // -------------------------------------------------------
  // LOAD DISCOUNTS
  // -------------------------------------------------------
  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await res.json();
    setDiscounts(json.discounts || []);
  };

  useEffect(() => {
    loadDiscounts();
    loadCustomers();
  }, []);

  // -------------------------------------------------------
  // OPEN MODAL
  // -------------------------------------------------------
  const openModal = (customer?: Customer) => {
    setEditingCustomer(customer || null);
    setShowModal(true);
  };

  // -------------------------------------------------------
  // DELETE CUSTOMER
  // -------------------------------------------------------
  const deleteCustomer = async (id: number) => {
    if (!confirm("Delete this customer?")) return;

    const res = await fetch(`/api/customers?id=${id}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      alert("Failed to delete customer.");
      return;
    }

    loadCustomers();
  };

  // -------------------------------------------------------
  // FILTER SEARCH RESULTS (name, phone, DISCOUNT)
  // -------------------------------------------------------
  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;

    const term = search.toLowerCase();
    const termNoPercent = term.replace("%", "");

    const matchesName = c.name.toLowerCase().includes(term);
    const matchesPhone = (c.phone || "").includes(search);

    const discount = discounts.find((d) => d.id === c.discount_id);
    const matchesDiscount = discount
      ? discount.name.toLowerCase().includes(term) ||
        String(discount.percent).includes(termNoPercent)
      : false;

    return matchesName || matchesPhone || matchesDiscount;
  });

  // -------------------------------------------------------
  // RENDER PAGE
  // -------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Customers</h2>
        <button
          onClick={() => openModal()}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2 rounded-lg font-medium"
        >
          + Add Customer
        </button>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search by name, phone, or discount..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
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
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Discount</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((c) => {
              const discount = discounts.find((d) => d.id === c.discount_id);

              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-800 hover:bg-slate-800"
                >
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className="p-3">{c.email || "-"}</td>
                  <td className="p-3">
                    {discount ? `${discount.name} (${discount.percent}%)` : "-"}
                  </td>

                  <td className="p-3 text-right">
                    <button
                      onClick={() => openModal(c)}
                      className="text-amber-400 hover:text-amber-300 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCustomer(c.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-slate-500 italic"
                >
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSaved={() => loadCustomers()}
        />
      )}
    </div>
  );
}
