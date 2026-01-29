// app/sales/page.tsx
"use client";

import { useEffect, useState } from "react";

type Sale = {
  id: number;
  staff_id: number;
  staff_name: string;
  customer_id: number | null;
  customer_name: string | null;
  final_total: number;
  created_at: string;
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSale, setSelectedSale] = useState<number | null>(null);
  const [saleDetails, setSaleDetails] = useState<any>(null);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [session, setSession] = useState<any>(null);
  const [roleLevel, setRoleLevel] = useState<number>(0);

  // ---------------------------------------------------
  async function loadSession() {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const json = await res.json();
    setSession(json.staff || null);
    setRoleLevel(Number(json.staff?.permissions_level ?? 0));
  }

  async function loadSales() {
    const res = await fetch("/api/sales/list");
    const json = await res.json();
    setSales(json.sales ?? []);
    setFilteredSales(json.sales ?? []);
    setLoading(false);
  }

  async function openSale(id: number) {
    setSelectedSale(id);

    const res = await fetch(`/api/sales/details?id=${id}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch sale details", await res.text());
      return;
    }

    const json = await res.json();
    setSaleDetails(json);
  }

  async function voidItem(itemId: number) {
    if (!confirm("Void this item?")) return;
    if (roleLevel < 800) return alert("Insufficient permissions.");

    await fetch("/api/sales/void-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });

    openSale(selectedSale!);
    loadSales();
  }

  async function voidSale() {
    if (!confirm("VOID ENTIRE SALE?")) return;
    if (roleLevel < 800) return alert("Insufficient permissions.");

    await fetch("/api/sales/void-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sale_id: selectedSale }),
    });

    setSelectedSale(null);
    setSaleDetails(null);
    loadSales();
  }

  function applyFilters() {
    let filtered = [...sales];

    if (fromDate) {
      filtered = filtered.filter(
        (s) => new Date(s.created_at) >= new Date(fromDate)
      );
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59);
      filtered = filtered.filter((s) => new Date(s.created_at) <= end);
    }

    setFilteredSales(filtered);
  }

  useEffect(() => {
    loadSession();
    loadSales();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [fromDate, toDate]);

  return (
    <div className="min-h-screen bg-transparent text-white px-8 pt-24">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      {/* DATE FILTERS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex gap-4 items-end w-[420px]">
        <div className="flex flex-col">
          <label className="text-sm text-slate-400 mb-1">From</label>
          <input
            type="date"
            className="bg-slate-800 border border-slate-700 p-2 rounded text-white"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-slate-400 mb-1">To</label>
          <input
            type="date"
            className="bg-slate-800 border border-slate-700 p-2 rounded text-white"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* SALES LIST */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">All Sales</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {filteredSales.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-slate-800 rounded cursor-pointer hover:bg-slate-700"
                onClick={() => openSale(s.id)}
              >
                <div className="flex justify-between">
                  <span>
                    Sale #{s.id} —{" "}
                    <span className="text-slate-400">
                      {s.customer_name || "No Customer"}
                    </span>{" "}
                    — <span className="text-slate-400">{s.staff_name}</span>
                  </span>
                  <span>${s.final_total}</span>
                </div>

                <p className="text-slate-400 text-sm">
                  {new Date(s.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SALE DETAILS MODAL */}
      {saleDetails && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-[600px] p-6">
            <h2 className="text-2xl font-bold mb-4">
              Sale #{saleDetails.sale.id}
            </h2>

            <p className="text-slate-300 mb-2">
              <strong>Customer:</strong>{" "}
              {saleDetails.sale.customer_name || "None"}
            </p>

            <p className="text-slate-300 mb-4">
              <strong>Salesperson:</strong> {saleDetails.sale.staff_name}
            </p>

            <h3 className="text-xl font-semibold mb-2">Items</h3>

            <div className="space-y-3">
              {saleDetails.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex justify-between bg-slate-800 p-3 rounded"
                >
                  <div>
                    <p>{item.item_name}</p>
                    <p className="text-sm text-slate-400">
                      ${item.price_each} × {item.quantity}
                    </p>
                  </div>

                  {!item.voided ? (
                    <button
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded"
                      onClick={() => voidItem(item.id)}
                    >
                      Void
                    </button>
                  ) : (
                    <span className="text-red-400">Voided</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                className="px-4 py-2 bg-slate-700 rounded"
                onClick={() => {
                  setSelectedSale(null);
                  setSaleDetails(null);
                }}
              >
                Close
              </button>

              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
                onClick={voidSale}
              >
                Void Entire Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
