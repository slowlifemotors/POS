// app/jobs/components/JobsClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SessionStaff = { id: number; username: string; role: string };

type OrderRow = {
  id: string;
  status: string; // paid | void | open
  vehicle_id: number;
  staff_id: number;
  customer_id: number | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  note: string | null;
  created_at: string;
  voided_at?: string | null;
  void_reason?: string | null;
  voided_by_staff_id?: number | null;
};

type OrderLineRow = {
  id?: string;
  order_id: string;
  mod_name: string;
  quantity: number;
  unit_price: number;
  pricing_type: "percentage" | "flat" | string | null;
  pricing_value: number | null;
  created_at?: string;
  is_voided?: boolean;
  void_reason?: string | null;
  voided_at?: string | null;
};

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function fmtMoney(n: number) {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return v.toFixed(2);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function JobsClient({
  sessionStaff,
  orders,
  linesByOrderId,
  vehicleNameById,
  staffNameById,
  customerNameById,
  bannerWarnings,
}: {
  sessionStaff: SessionStaff;
  orders: OrderRow[];
  linesByOrderId: Record<string, OrderLineRow[]>;
  vehicleNameById: Record<string, string>;
  staffNameById: Record<string, string>;
  customerNameById: Record<string, string>;
  bannerWarnings: string[];
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // track which orders are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const safeOrders = Array.isArray(orders) ? orders : [];
  const shownCount = useMemo(() => safeOrders.length, [safeOrders]);

  function toggleExpanded(orderId: string) {
    setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  async function voidOrder(orderId: string) {
    const reason = prompt("Reason for voiding this entire job?", "Voided");
    if (reason == null) return;

    setBusyKey(`order:${orderId}`);
    try {
      const res = await fetch("/api/orders/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId, reason }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Failed to void order.");
        return;
      }

      alert("Order voided.");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function voidLine(orderId: string, lineId: string) {
    const reason = prompt("Reason for voiding this item?", "Voided item");
    if (reason == null) return;

    setBusyKey(`line:${lineId}`);
    try {
      const res = await fetch("/api/orders/void-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId, line_id: lineId, reason }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Failed to void item.");
        return;
      }

      alert(json?.order_voided ? "Last remaining item voided — order was voided." : "Item voided.");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="text-slate-400 text-sm">Completed job history.</p>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="font-semibold">{sessionStaff.username}</p>
            <p className="text-xs text-slate-500">{roleLower(sessionStaff.role)}</p>
          </div>
        </div>

        {bannerWarnings.length > 0 && (
          <div className="mb-6 p-3 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-200 text-sm">
            <p className="font-semibold mb-1">Some lookups failed (showing best-effort data):</p>
            <ul className="list-disc pl-5 space-y-1">
              {bannerWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="font-semibold">Jobs</p>
            <p className="text-sm text-slate-400">{shownCount} shown</p>
          </div>

          {safeOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No jobs found.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {safeOrders.map((o) => {
                const vName = vehicleNameById[String(o.vehicle_id)] ?? `Vehicle #${o.vehicle_id}`;
                const sName = staffNameById[String(o.staff_id)] ?? `Staff #${o.staff_id}`;
                const cName =
                  o.customer_id == null
                    ? "Walk-in"
                    : customerNameById[String(o.customer_id)] ?? `Customer #${o.customer_id}`;

                const orderLines = Array.isArray(linesByOrderId[o.id]) ? linesByOrderId[o.id] : [];
                const orderIsVoided = String(o.status ?? "").toLowerCase() === "void";
                const isOpen = Boolean(expanded[o.id]);

                const activeLinesCount = orderLines.filter((l) => !l.is_voided).length;
                const voidedLinesCount = orderLines.filter((l) => Boolean(l.is_voided)).length;

                return (
                  <div key={o.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-slate-50">{vName}</p>
                        <p className="text-sm text-slate-300">
                          Staff: <span className="font-semibold text-slate-100">{sName}</span>
                          {" · "}
                          Customer: <span className="font-semibold text-slate-100">{cName}</span>
                        </p>

                        <p className="text-xs text-slate-500">
                          {fmtDate(o.created_at)} · Order #{o.id}
                        </p>

                        {o.note && (
                          <p className="text-sm text-slate-200 mt-2">
                            <span className="text-slate-400">Note:</span> {o.note}
                          </p>
                        )}

                        {orderIsVoided && (
                          <div className="mt-2 text-xs text-red-300">
                            <p className="font-semibold">VOID</p>
                            {o.void_reason && <p>Reason: {o.void_reason}</p>}
                            {o.voided_at && <p>At: {fmtDate(o.voided_at)}</p>}
                          </div>
                        )}
                      </div>

                      <div className="md:text-right space-y-2">
                        <div>
                          <p className="text-sm text-slate-400">Subtotal: ${fmtMoney(o.subtotal)}</p>
                          <p className="text-sm text-slate-400">
                            Discount: -${fmtMoney(o.discount_amount)}
                          </p>
                          <p className="text-xl font-bold text-emerald-400">Total: ${fmtMoney(o.total)}</p>
                          <p className="text-xs text-slate-500 mt-1">Status: {o.status}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => voidOrder(o.id)}
                          disabled={orderIsVoided || busyKey === `order:${o.id}`}
                          className="px-4 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {busyKey === `order:${o.id}` ? "Voiding..." : "Void Entire Job"}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible mods section */}
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(o.id)}
                        className="w-full px-3 py-2 border-b border-slate-800 flex items-center justify-between text-left hover:bg-slate-900/40"
                      >
                        <div className="text-sm font-semibold text-slate-200">
                          Mods applied
                          <span className="ml-2 text-xs text-slate-400 font-normal">
                            ({activeLinesCount} active{voidedLinesCount ? `, ${voidedLinesCount} voided` : ""})
                          </span>
                        </div>

                        <div className="text-xs text-slate-400">
                          {isOpen ? "Hide" : "Show"} <span className="ml-1">{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {!isOpen ? (
                        <div className="px-3 py-3 text-sm text-slate-400">
                          Collapsed. Click <span className="text-slate-200 font-semibold">Show</span> to view mods.
                        </div>
                      ) : orderLines.length === 0 ? (
                        <div className="p-3 text-sm text-slate-400">No lines found.</div>
                      ) : (
                        <div className="divide-y divide-slate-800">
                          {orderLines.map((l, idx) => {
                            const lineId = l.id ? String(l.id) : "";
                            const lineIsVoided = Boolean(l.is_voided);
                            const canVoidLine = !orderIsVoided && !lineIsVoided && lineId.length > 0;

                            return (
                              <div
                                key={lineId || `${o.id}:${idx}`}
                                className="px-3 py-2 text-sm flex items-start justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <p
                                    className={`text-slate-100 truncate ${
                                      lineIsVoided ? "line-through opacity-60" : ""
                                    }`}
                                  >
                                    {l.mod_name}
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    Pricing: {l.pricing_type ?? "?"}{" "}
                                    {l.pricing_value != null ? `(${l.pricing_value})` : ""}
                                  </p>

                                  {lineIsVoided && (
                                    <p className="text-xs text-red-300 mt-1">
                                      VOID{l.void_reason ? ` — ${l.void_reason}` : ""}
                                    </p>
                                  )}
                                </div>

                                <div className="text-right shrink-0 space-y-2">
                                  <div>
                                    <p className="text-slate-200">
                                      {l.quantity} × ${fmtMoney(l.unit_price)}
                                    </p>
                                    <p className="text-slate-400 text-xs">
                                      Line: ${fmtMoney(Number(l.unit_price) * Number(l.quantity))}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={!canVoidLine || busyKey === `line:${lineId}`}
                                    onClick={() => voidLine(o.id, lineId)}
                                    className="px-3 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={
                                      !lineId
                                        ? "Missing line id (check order_lines select includes id)"
                                        : orderIsVoided
                                        ? "Order is voided"
                                        : lineIsVoided
                                        ? "Line already voided"
                                        : "Void this item"
                                    }
                                  >
                                    {busyKey === `line:${lineId}` ? "Voiding..." : "Void Item"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Manager+ can void items or entire jobs. Voids are audit-tracked.
        </p>
      </div>
    </div>
  );
}
