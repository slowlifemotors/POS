// app/items/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Vehicle = {
  id: number;
  manufacturer: string;
  model: string;
  base_price: number;
  category: string | null;
  stock_class: string | null;
  maxed_class: string | null;
  note: string | null;
  active: boolean;
};

const CLASS_OPTIONS = [
  "Unknown",
  "E",
  "D",
  "C",
  "B",
  "A",
  "S1",
  "S2",
  "S3",
  "S4",
  "X",
];

const CATEGORY_OPTIONS = [
  "Gold",
  "Diamond",
  "N/A",
  "Bike",
  "Compact",
  "Coupe",
  "Muscle",
  "Off Road",
  "Sedan",
  "Special",
  "Sports",
  "Sports Classic",
  "SUV",
  "Super",
  "Truck",
  "Van",
];

export default function ItemsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [category, setCategory] = useState("N/A");
  const [stockClass, setStockClass] = useState("Unknown");
  const [maxedClass, setMaxedClass] = useState("Unknown");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  async function loadVehicles() {
    const res = await fetch("/api/vehicles", { cache: "no-store" });
    const json = await res.json();
    setVehicles(Array.isArray(json.vehicles) ? json.vehicles : []);
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  const openModal = (v?: Vehicle) => {
    if (v) {
      setEditing(v);
      setManufacturer(v.manufacturer);
      setModel(v.model);
      setBasePrice(String(v.base_price));
      setCategory(v.category ?? "N/A");
      setStockClass(v.stock_class ?? "Unknown");
      setMaxedClass(v.maxed_class ?? "Unknown");
      setNote(v.note ?? "");
      setActive(v.active);
    } else {
      setEditing(null);
      setManufacturer("");
      setModel("");
      setBasePrice("");
      setCategory("N/A");
      setStockClass("Unknown");
      setMaxedClass("Unknown");
      setNote("");
      setActive(true);
    }

    setShowModal(true);
  };

  const saveVehicle = async () => {
    if (!manufacturer.trim()) return alert("Manufacturer is required.");
    if (!model.trim()) return alert("Model is required.");

    const payload = {
      id: editing?.id,
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      base_price: Number(basePrice || 0),
      category,
      stock_class: stockClass,
      maxed_class: maxedClass,
      note: note.trim() || null,
      active,
    };

    const res = await fetch("/api/vehicles", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Failed to save vehicle");
      return;
    }

    setShowModal(false);
    loadVehicles();
  };

  const deleteVehicle = async (id: number) => {
    if (!confirm("Delete this vehicle?")) return;

    await fetch("/api/vehicles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadVehicles();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter((v) =>
      `${v.manufacturer} ${v.model}`.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Vehicles</h2>

        <button
          onClick={() => openModal()}
          className="bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] px-4 py-2 rounded-lg"
        >
          + Add Vehicle
        </button>
      </div>

      <input
        type="text"
        placeholder="Search vehicles..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Manufacturer</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Base Price</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Stock</th>
              <th className="p-3 text-left">Maxed</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((v) => (
              <tr
                key={v.id}
                className="border-b border-slate-800 hover:bg-slate-800"
              >
                <td className="p-3">{v.manufacturer}</td>
                <td className="p-3">{v.model}</td>
                <td className="p-3">
                  ${Number(v.base_price).toLocaleString()}
                </td>
                <td className="p-3">{v.category ?? "-"}</td>
                <td className="p-3">{v.stock_class ?? "-"}</td>
                <td className="p-3">{v.maxed_class ?? "-"}</td>
                <td className="p-3">{v.active ? "Yes" : "No"}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => openModal(v)}
                    className="text-amber-400 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteVehicle(v.id)}
                    className="text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                  No vehicles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
          <div className="bg-slate-900 p-6 rounded-xl w-[520px] border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">
              {editing ? "Edit Vehicle" : "Add Vehicle"}
            </h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Manufacturer"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
                <input
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  placeholder="Model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              <input
                type="number"
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                placeholder="Base price"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />

              <div className="flex gap-4">
                <select
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>

                <select
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  value={stockClass}
                  onChange={(e) => setStockClass(e.target.value)}
                >
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>

                <select
                  className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded"
                  value={maxedClass}
                  onChange={(e) => setMaxedClass(e.target.value)}
                >
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <textarea
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                placeholder="Notes"
                value={note}
                onChange={(e) => setNote(e.target.value)}
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

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveVehicle}
                className="px-4 py-2 bg-emerald-600 rounded font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
