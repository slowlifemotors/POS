// app/pos/components/SavedJobsModal.tsx
"use client";

import { useEffect, useState } from "react";

type OpenOrderRow = {
  id: string;
  created_at: string;
  updated_at: string;
  total: number;
  plate: string | null;
  note: string | null;
};

export default function SavedJobsModal({
  onClose,
  onPick,
  onDelete,
  list,
}: {
  onClose: () => void;
  onPick: (orderId: string) => void;
  onDelete: (orderId: string) => Promise<void>;
  list: () => Promise<OpenOrderRow[]>;
}) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OpenOrderRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await list();
      setOrders(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const del = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await onDelete(id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-slate-900 w-[720px] max-w-[95vw] p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">Saved Jobs</h2>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
            type="button"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-slate-400">No saved jobs.</div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="p-3 bg-slate-800 border border-slate-700 rounded flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{o.id}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Updated: {new Date(o.updated_at).toLocaleString()}
                    {o.plate ? ` • Plate: ${o.plate}` : ""}
                  </div>
                  {o.note ? <div className="text-xs text-slate-300 mt-1 truncate">{o.note}</div> : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-sm font-bold">${Math.ceil(Number(o.total || 0)).toLocaleString()}</div>

                  <button
                    type="button"
                    onClick={() => onPick(o.id)}
                    className="px-3 py-2 rounded bg-(--accent) hover:bg-(--accent-hover) text-white font-semibold"
                  >
                    Load
                  </button>

                  <button
                    type="button"
                    onClick={() => del(o.id)}
                    disabled={busyId === o.id}
                    className="px-3 py-2 rounded bg-red-700/60 hover:bg-red-600 text-white disabled:bg-red-900/30 disabled:text-red-200"
                    title="Delete saved job"
                  >
                    {busyId === o.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={reload}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
            type="button"
          >
            Refresh list
          </button>
        </div>
      </div>
    </div>
  );
}
