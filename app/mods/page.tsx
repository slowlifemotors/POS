// app/mods/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StaffSession = {
  staff?: {
    id: number;
    username: string;
    role: string;
    permissions_level?: number;
  } | null;
};

type VehicleMod = {
  id: number;
  key: string;
  label: string;
  pricing_type: "percent" | "flat";
  percent: number;
  flat_price: number | null;
  section: string | null;
  sort_order: number;
  active: boolean;
};

function isAdminOrOwner(role: string | null | undefined) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "owner";
}

export default function ModsPage() {
  const router = useRouter();

  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mods, setMods] = useState<VehicleMod[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VehicleMod | null>(null);

  const [keyVal, setKeyVal] = useState("");
  const [label, setLabel] = useState("");
  const [pricingType, setPricingType] = useState<"percent" | "flat">("percent");
  const [percent, setPercent] = useState("");
  const [flatPrice, setFlatPrice] = useState("");
  const [section, setSection] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json: StaffSession = await res.json();
      const role = json?.staff?.role ?? null;

      if (!json?.staff) {
        router.push("/login");
        return;
      }

      setStaffRole(role);
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadMods() {
    const res = await fetch("/api/mods", { cache: "no-store" });
    const json = await res.json();
    setMods(Array.isArray(json.mods) ? json.mods : []);
  }

  useEffect(() => {
    loadSession();
    loadMods();
  }, []);

  const openModal = (m?: VehicleMod) => {
    if (m) {
      setEditing(m);
      setKeyVal(m.key);
      setLabel(m.label);

      setPricingType(m.pricing_type ?? "percent");
      setPercent(String(m.percent ?? 0));
      setFlatPrice(m.flat_price != null ? String(m.flat_price) : "");

      setSection(m.section ?? "");
      setSortOrder(String(m.sort_order ?? 0));
      setActive(Boolean(m.active));
    } else {
      setEditing(null);
      setKeyVal("");
      setLabel("");

      setPricingType("percent");
      setPercent("");
      setFlatPrice("");

      setSection("");
      setSortOrder("0");
      setActive(true);
    }

    setShowModal(true);
  };

  const saveMod = async () => {
    if (!keyVal.trim()) return alert("Key is required.");
    if (!label.trim()) return alert("Label is required.");

    if (pricingType === "percent") {
      const pct = Number(percent);
      if (!Number.isFinite(pct) || pct < 0) return alert("Percent must be a valid number (>= 0).");
    } else {
      const fp = Number(flatPrice);
      if (!Number.isFinite(fp) || fp < 0) return alert("Flat price must be a valid number (>= 0).");
    }

    const payload = {
      id: editing?.id,
      key: keyVal.trim(),
      label: label.trim(),
      pricing_type: pricingType,
      percent: pricingType === "percent" ? Number(percent) : 0,
      flat_price: pricingType === "flat" ? Number(flatPrice) : null,
      section: section.trim() || null,
      sort_order: Number(sortOrder || 0),
      active,
    };

    const res = await fetch("/api/mods", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || "Failed to save mod");
      return;
    }

    setShowModal(false);
    loadMods();
  };

  const deleteMod = async (id: number) => {
    if (!confirm("Delete this mod?")) return;

    const res = await fetch("/api/mods", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || "Failed to delete mod");
      return;
    }

    loadMods();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return mods;

    return mods.filter((m) =>
      `${m.key} ${m.label} ${m.section ?? ""}`.toLowerCase().includes(q)
    );
  }, [mods, search]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!isAdminOrOwner(staffRole)) {
    return (
      <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg backdrop-blur">
          <h2 className="text-2xl font-bold text-red-400">Forbidden</h2>
          <p className="text-slate-300 mt-2">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const pricingLabel = (m: VehicleMod) => {
    if (m.pricing_type === "flat") {
      const v = Number(m.flat_price ?? 0);
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${Number(m.percent ?? 0).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Mods / Items</h2>

        <button
          onClick={() => openModal()}
          className="bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] px-4 py-2 rounded-lg"
        >
          + Add Mod
        </button>
      </div>

      <input
        type="text"
        placeholder="Search mods..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Key</th>
              <th className="p-3 text-left">Label</th>
              <th className="p-3 text-left">Pricing</th>
              <th className="p-3 text-left">Section</th>
              <th className="p-3 text-left">Sort</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800">
                <td className="p-3 font-mono text-slate-200">{m.key}</td>
                <td className="p-3">{m.label}</td>
                <td className="p-3">{pricingLabel(m)}</td>
                <td className="p-3">{m.section ?? "-"}</td>
                <td className="p-3">{m.sort_order ?? 0}</td>
                <td className="p-3">{m.active ? "Yes" : "No"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openModal(m)} className="text-amber-400 mr-4">
                    Edit
                  </button>
                  <button onClick={() => deleteMod(m.id)} className="text-red-400">
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                  No mods found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
          <div className="bg-slate-900 p-6 rounded-xl w-[560px] border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">{editing ? "Edit Mod" : "Add Mod"}</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Key (e.g. engine)"
                  value={keyVal}
                  onChange={(e) => setKeyVal(e.target.value)}
                />
                <input
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Label (e.g. Engine)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <select
                  className="w-48 p-2 bg-slate-800 border border-slate-700 rounded"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value as "percent" | "flat")}
                >
                  <option value="percent">Percent of base</option>
                  <option value="flat">Flat price</option>
                </select>

                {pricingType === "percent" ? (
                  <input
                    type="number"
                    className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                    placeholder="Percent (e.g. 11)"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    step="0.01"
                  />
                ) : (
                  <input
                    type="number"
                    className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                    placeholder="Flat price (e.g. 2000)"
                    value={flatPrice}
                    onChange={(e) => setFlatPrice(e.target.value)}
                    step="0.01"
                  />
                )}

                <input
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Section (optional)"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                />
              </div>

              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  className="w-40 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Sort order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <p className="text-xs text-slate-400">
                Percent mods calculate from vehicle base price. Flat mods ignore base price.
              </p>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-700 rounded">
                Cancel
              </button>

              <button onClick={saveMod} className="px-4 py-2 bg-emerald-600 rounded font-semibold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
