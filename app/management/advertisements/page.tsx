// app/management/advertisements/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Ad = {
  id: number;
  text: string;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function AdvertisementsPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<any>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [newText, setNewText] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);
  const [newOrder, setNewOrder] = useState<number>(0);

  // edit modal
  const [editing, setEditing] = useState<Ad | null>(null);
  const [editText, setEditText] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editOrder, setEditOrder] = useState<number>(0);

  const canEdit = useMemo(() => Boolean(staff), [staff]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${window.location.origin}/api/auth/session`, {
        method: "GET",
        credentials: "include",
      });
      const session = await res.json().catch(() => ({}));
      if (!session?.staff) {
        router.push("/login");
        return;
      }
      setStaff(session.staff);
    })();
  }, [router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ads", { cache: "no-store" });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to load ads.");
      setAds(Array.isArray(json.ads) ? json.ads : []);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load ads.");
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (staff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  const create = async () => {
    const text = newText.trim();
    if (!text) return alert("Ad text is required.");

    const res = await fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        enabled: newEnabled,
        display_order: Number(newOrder) || 0,
      }),
    });

    const json = await safeJson(res);
    if (!res.ok) return alert(json?.error || "Failed to create.");

    setNewText("");
    setNewEnabled(true);
    setNewOrder(0);
    await load();
  };

  const openEdit = (ad: Ad) => {
    setEditing(ad);
    setEditText(ad.text ?? "");
    setEditEnabled(Boolean(ad.enabled));
    setEditOrder(Number(ad.display_order ?? 0));
  };

  const saveEdit = async () => {
    if (!editing) return;

    const text = editText.trim();
    if (!text) return alert("Ad text cannot be empty.");

    const res = await fetch("/api/ads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        text,
        enabled: editEnabled,
        display_order: Number(editOrder) || 0,
      }),
    });

    const json = await safeJson(res);
    if (!res.ok) return alert(json?.error || "Failed to update.");

    setEditing(null);
    await load();
  };

  const toggleEnabled = async (ad: Ad) => {
    const res = await fetch("/api/ads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id, enabled: !ad.enabled }),
    });

    const json = await safeJson(res);
    if (!res.ok) return alert(json?.error || "Failed to update.");
    await load();
  };

  const remove = async (ad: Ad) => {
    if (!confirm(`Delete this advertisement?\n\n"${ad.text}"`)) return;

    const res = await fetch("/api/ads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ad.id }),
    });

    const json = await safeJson(res);
    if (!res.ok) return alert(json?.error || "Failed to delete.");
    await load();
  };

  if (!canEdit) return null;

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Advertisements</h1>
          <p className="text-slate-400 mt-1">
            These appear in the POS ad panel. Ads are text + emojis only.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {/* Create */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Add New</h2>

        <label className="block text-sm text-slate-300 mb-1">Text</label>
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 mb-3"
          rows={3}
          placeholder="/ad 🔧^8Slowlife Mechanics is now open at ^0PC 529 ^7— honest advice, fair pricing, and quality work you can rely on. ^8Take it slow, drive it right.🚗💨"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />

        <div className="flex flex-wrap gap-3 items-center mb-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={newEnabled} onChange={(e) => setNewEnabled(e.target.checked)} />
            Enabled
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Order</span>
            <input
              type="number"
              className="w-24 bg-slate-800 border border-slate-700 rounded p-2"
              value={Number.isFinite(newOrder) ? newOrder : 0}
              onChange={(e) => setNewOrder(Number(e.target.value))}
            />
          </div>

          <button
            type="button"
            onClick={create}
            className="ml-auto px-4 py-2 rounded-lg bg-(--accent) hover:bg-(--accent-hover) text-white font-semibold"
          >
            Create
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-semibold">All Ads</div>
          <div className="text-sm text-slate-400">{ads.length} total</div>
        </div>

        {loading ? (
          <div className="p-4 text-slate-400">Loading…</div>
        ) : ads.length === 0 ? (
          <div className="p-4 text-slate-500">No advertisements yet.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {ads.map((ad) => (
              <div key={ad.id} className="p-4 flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        ad.enabled
                          ? "bg-emerald-900/30 border-emerald-700 text-emerald-200"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      {ad.enabled ? "Enabled" : "Disabled"}
                    </span>

                    <span className="text-xs text-slate-400">Order: {ad.display_order}</span>
                    <span className="text-xs text-slate-500">ID: {ad.id}</span>
                  </div>

                  <div className="whitespace-pre-wrap wrap-break-word text-slate-100 font-semibold">
                    {ad.text}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(ad)}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm"
                  >
                    {ad.enabled ? "Disable" : "Enable"}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEdit(ad)}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(ad)}
                    className="px-3 py-2 rounded-lg bg-red-900/30 border border-red-700 hover:bg-red-900/50 text-red-200 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-slate-900 w-110 p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Edit Advertisement</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                Close
              </button>
            </div>

            <label className="block text-sm text-slate-300 mb-1">Text</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 mb-3"
              rows={4}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            <div className="flex flex-wrap gap-3 items-center mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
                Enabled
              </label>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">Order</span>
                <input
                  type="number"
                  className="w-24 bg-slate-800 border border-slate-700 rounded p-2"
                  value={Number.isFinite(editOrder) ? editOrder : 0}
                  onChange={(e) => setEditOrder(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={saveEdit}
                className="flex-1 py-2 rounded font-semibold bg-(--accent) hover:bg-(--accent-hover) text-white"
              >
                Save
              </button>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
