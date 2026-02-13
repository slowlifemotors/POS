// app/customers/page.tsx
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

  note: string | null;

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

function NotesModal({
  customer,
  onClose,
  onEdit,
}: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-105 text-slate-100 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Notes</h2>
            <p className="text-sm text-slate-400 mt-1">{customer.name}</p>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
            type="button"
          >
            Close
          </button>
        </div>

        <textarea
          className="mt-4 w-full bg-slate-800 border border-slate-700 p-3 rounded text-slate-100"
          rows={8}
          value={customer.note ?? ""}
          readOnly
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onEdit}
            className="px-4 py-2 rounded bg-(--accent) hover:bg-(--accent-hover) text-white"
            type="button"
          >
            Edit Customer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [blacklistModal, setBlacklistModal] = useState(false);
  const [blacklistCustomer, setBlacklistCustomer] = useState<Customer | null>(null);

  const [notesModal, setNotesModal] = useState(false);
  const [notesCustomer, setNotesCustomer] = useState<Customer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadCustomers() {
    const res = await fetch("/api/customers", { cache: "no-store" });
    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.error || `Failed to load customers (${res.status})`);
    }
    setCustomers(json.customers || []);
  }

  async function loadDiscounts() {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.error || `Failed to load discounts (${res.status})`);
    }
    setDiscounts(json.discounts || []);
  }

  async function refreshAll() {
    setError(null);
    setIsLoading(true);
    try {
      await Promise.all([loadCustomers(), loadDiscounts()]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* discount_id → "Name (X%)" */
  const discountLabelById = useMemo(() => {
    const map = new Map<number, string>();
    discounts.forEach((d) => {
      map.set(d.id, `${d.name} (${Number(d.percent ?? 0)}%)`);
    });
    return map;
  }, [discounts]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;

    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = c.phone || "";
      return name.includes(term) || phone.includes(search);
    });
  }, [customers, search]);

  function membershipText(c: Customer) {
    if (!c.membership_active) return "-";
    return `${c.membership_start ?? "?"} → ${c.membership_end ?? "?"}`;
  }

  function discountText(c: Customer) {
    if (!c.discount_id) return "No Discount";
    return discountLabelById.get(c.discount_id) ?? "Unknown Discount";
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this customer?")) return;

    setError(null);
    try {
      const res = await fetch(`/api/customers?id=${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const json = await safeJson(res);

      if (!res.ok) {
        throw new Error(json?.error || `Delete failed (${res.status})`);
      }

      setCustomers((prev) => prev.filter((c) => c.id !== id));
      await loadCustomers();
    } catch (e: any) {
      setError(e?.message || "Delete failed.");
    }
  }

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            className="px-4 py-2 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700"
            type="button"
          >
            Refresh
          </button>

          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-lg font-semibold bg-(--accent) hover:bg-(--accent-hover)"
            type="button"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 rounded border border-red-700/50 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      )}

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
        {isLoading ? (
          <div className="p-6 text-slate-400">Loading…</div>
        ) : (
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
                      type="button"
                    >
                      Edit
                    </button>

                    {/* ✅ Notes button (green) only if note exists */}
                    {c.note && c.note.trim() && (
                      <button
                        onClick={() => {
                          setNotesCustomer(c);
                          setNotesModal(true);
                        }}
                        className="text-green-400 hover:text-green-300"
                        type="button"
                      >
                        Notes
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setBlacklistCustomer(c);
                        setBlacklistModal(true);
                      }}
                      className="text-red-400 hover:text-red-300"
                      type="button"
                    >
                      Blacklist
                    </button>

                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-500 hover:text-red-400"
                      type="button"
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
        )}
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

      {notesModal && notesCustomer && (
        <NotesModal
          customer={notesCustomer}
          onClose={() => setNotesModal(false)}
          onEdit={() => {
            setNotesModal(false);
            setEditingCustomer(notesCustomer);
            setShowModal(true);
          }}
        />
      )}
    </div>
  );
}
