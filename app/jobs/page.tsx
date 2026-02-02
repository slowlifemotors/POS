// app/jobs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type OrderStatus = "open" | "paid" | "void";

type OrderRow = {
  id: string;
  status: OrderStatus;
  vehicle_id: number;
  staff_id: number;
  customer_id: number | null;
  discount_id: number | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type OrderLine = {
  id: string;
  order_id: string;
  vehicle_id: number;
  mod_id: string;
  mod_name: string;
  quantity: number;
  unit_price: number;
  pricing_type: "percentage" | "flat";
  pricing_value: number;
  created_at: string;
};

function fmtMoney(n: number) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

function fmtDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<"open" | "paid" | "void" | "all">("open");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);
  const [viewLines, setViewLines] = useState<OrderLine[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    const res = await fetch(`/api/orders?status=${encodeURIComponent(statusFilter)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    setOrders(Array.isArray(json.orders) ? (json.orders as OrderRow[]) : []);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const hay = [
        o.id,
        String(o.vehicle_id),
        String(o.staff_id),
        String(o.customer_id ?? ""),
        String(o.discount_id ?? ""),
        o.status,
        o.note ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [orders, search]);

  const openOrder = async (id: string) => {
    setViewingId(id);
    setViewLoading(true);
    setViewOrder(null);
    setViewLines([]);

    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    setViewOrder(json.order ?? null);
    setViewLines(Array.isArray(json.lines) ? (json.lines as OrderLine[]) : []);
    setViewLoading(false);
  };

  const closeModal = () => {
    setViewingId(null);
    setViewOrder(null);
    setViewLines([]);
    setViewLoading(false);
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    if (!confirm(`Set this job to "${status}"?`)) return;

    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || "Failed to update job status");
      return;
    }

    // refresh list and modal data
    await loadOrders();
    if (viewingId) await openOrder(viewingId);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Jobs</h2>

        <button
          onClick={loadOrders}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <select
          className="p-3 bg-slate-900 border border-slate-700 rounded-lg w-full md:w-[220px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
          <option value="all">All</option>
        </select>

        <input
          type="text"
          placeholder="Search by id, vehicle_id, staff_id, note..."
          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Order ID</th>
              <th className="p-3 text-left">Vehicle</th>
              <th className="p-3 text-left">Staff</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : (
              <>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800">
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          o.status === "open"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                            : o.status === "paid"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                              : "bg-red-500/20 text-red-300 border border-red-400/30"
                        }`}
                      >
                        {o.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{o.id}</td>
                    <td className="p-3">{o.vehicle_id}</td>
                    <td className="p-3">{o.staff_id}</td>
                    <td className="p-3">{o.customer_id ?? "-"}</td>
                    <td className="p-3 font-semibold">{fmtMoney(o.total)}</td>
                    <td className="p-3 text-slate-300">{fmtDate(o.created_at)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openOrder(o.id)}
                        className="text-amber-400 hover:text-amber-300 mr-4"
                      >
                        View
                      </button>
                      {o.status !== "void" && (
                        <button
                          onClick={() => updateStatus(o.id, "void")}
                          className="text-red-400 hover:text-red-300"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                      No jobs found.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW MODAL */}
      {viewingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-1000 p-4">
          <div className="bg-slate-900 w-full max-w-[860px] rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Job Details</h3>
                <p className="text-xs text-slate-400 font-mono">{viewingId}</p>
              </div>

              <button
                onClick={closeModal}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              {viewLoading || !viewOrder ? (
                <p className="text-slate-400">Loading...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800">
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="font-semibold">{viewOrder.status.toUpperCase()}</p>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800">
                      <p className="text-xs text-slate-400">Vehicle</p>
                      <p className="font-semibold">{viewOrder.vehicle_id}</p>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800">
                      <p className="text-xs text-slate-400">Totals</p>
                      <p className="font-semibold">
                        {fmtMoney(viewOrder.subtotal)}{" "}
                        <span className="text-slate-400">-</span>{" "}
                        {fmtMoney(viewOrder.discount_amount)}{" "}
                        <span className="text-slate-400">=</span>{" "}
                        {fmtMoney(viewOrder.total)}
                      </p>
                    </div>
                  </div>

                  {viewOrder.note && (
                    <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-800">
                      <p className="text-xs text-slate-400 mb-1">Note</p>
                      <p className="text-slate-100 whitespace-pre-wrap">{viewOrder.note}</p>
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Line Items</h4>

                    <div className="flex gap-2">
                      {viewOrder.status !== "paid" && viewOrder.status !== "void" && (
                        <button
                          onClick={() => updateStatus(viewOrder.id, "paid")}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold"
                        >
                          Mark Paid
                        </button>
                      )}

                      {viewOrder.status !== "void" && (
                        <button
                          onClick={() => updateStatus(viewOrder.id, "void")}
                          className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 border-b border-slate-700">
                        <tr>
                          <th className="p-3 text-left">Mod</th>
                          <th className="p-3 text-left">Pricing</th>
                          <th className="p-3 text-right">Unit</th>
                          <th className="p-3 text-right">Qty</th>
                          <th className="p-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewLines.map((l) => (
                          <tr key={l.id} className="border-b border-slate-800">
                            <td className="p-3">{l.mod_name}</td>
                            <td className="p-3 text-slate-300">
                              {l.pricing_type === "percentage"
                                ? `${Number(l.pricing_value).toFixed(2)}%`
                                : fmtMoney(Number(l.pricing_value))}
                            </td>
                            <td className="p-3 text-right">{fmtMoney(Number(l.unit_price))}</td>
                            <td className="p-3 text-right">{l.quantity}</td>
                            <td className="p-3 text-right font-semibold">
                              {fmtMoney(Number(l.unit_price) * Number(l.quantity))}
                            </td>
                          </tr>
                        ))}

                        {viewLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                              No lines found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
