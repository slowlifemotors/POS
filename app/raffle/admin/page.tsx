// app/raffle/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LogRow = {
  id: string;
  sold_at: string;
  customer_name: string;
  tickets: number;
  order_id: string;
  staff_name: string | null;
  deleted_at: string | null;
};

function todayYMDLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RaffleAdminPage() {
  const router = useRouter();

  const [start, setStart] = useState<string>(todayYMDLocal());
  const [end, setEnd] = useState<string>(todayYMDLocal());

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [canDelete, setCanDelete] = useState(false);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  function validateRange() {
    if (!start || !end) return "Pick a start and end date.";
    if (start > end) return "Start date must be on or before end date.";
    return null;
  }

  // Role gate
  useEffect(() => {
    async function check() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!json?.staff) {
        router.push("/login");
        return;
      }
      const role = String(json?.staff?.role ?? "").toLowerCase();
      const okView = role === "owner" || role === "admin" || role === "manager";
      if (!okView) {
        router.push("/");
        return;
      }
      setCanDelete(role === "owner" || role === "admin");
    }
    check();
  }, [router]);

  async function load() {
    const rangeErr = validateRange();
    if (rangeErr) {
      setError(rangeErr);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/raffle/log?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&page=${page}&limit=${limit}`,
        { cache: "no-store" }
      );
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || `Failed to load (${res.status})`);

      setRows(Array.isArray(json?.rows) ? json.rows : []);
      setTotal(Number(json?.total ?? 0));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setError(e?.message ?? "Failed to load raffle logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  async function deleteRow(id: string) {
    if (!canDelete) return;
    if (!confirm("Delete this raffle log entry? This will soft-delete it.")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/raffle/log?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || `Delete failed (${res.status})`);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete row.");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(() => {
    const t = Math.max(0, total);
    const l = Math.max(1, limit);
    return Math.max(1, Math.ceil(t / l));
  }, [total, limit]);

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Raffle Logs</h1>

        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          className="px-4 py-2 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700"
          type="button"
          disabled={loading}
        >
          {loading ? "Loading..." : "Reload"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-700/50 bg-red-900/20 p-3 text-red-200">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Start</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">End</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Page size</label>
            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value));
              }}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end gap-3">
            <button
              onClick={() => {
                setPage(1);
                load();
              }}
              className="px-4 py-2 rounded-lg font-semibold bg-(--accent) hover:bg-(--accent-hover)"
              type="button"
              disabled={loading}
            >
              Apply
            </button>

            <div className="text-sm text-slate-400">
              Total rows: <span className="text-slate-200 font-semibold">{total}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="p-3 text-left">Sold At</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-right">Tickets</th>
                <th className="p-3 text-left">Staff</th>
                <th className="p-3 text-left">Order</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="p-4 text-slate-400" colSpan={6}>
                    {loading ? "Loading..." : "No rows for this range."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(r.sold_at).toLocaleString()}
                      {r.deleted_at ? (
                        <span className="ml-2 text-xs text-red-300">(deleted)</span>
                      ) : null}
                    </td>
                    <td className="p-3">{r.customer_name}</td>
                    <td className="p-3 text-right font-semibold">{r.tickets}</td>
                    <td className="p-3">{r.staff_name ?? "-"}</td>
                    <td className="p-3 font-mono text-xs text-slate-300">{r.order_id}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-md border ${
                          canDelete && !r.deleted_at
                            ? "bg-red-600 hover:bg-red-500 border-red-500 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                        }`}
                        disabled={!canDelete || !!r.deleted_at || loading}
                        onClick={() => deleteRow(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-900">
          <div className="text-xs text-slate-400">
            Page <span className="text-slate-200 font-semibold">{page}</span> of{" "}
            <span className="text-slate-200 font-semibold">{totalPages}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>

            <button
              type="button"
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Managers can view logs. Only Owner/Admin can delete (soft delete).
      </div>
    </div>
  );
}
