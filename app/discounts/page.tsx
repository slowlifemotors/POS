// app/discounts/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type Discount = {
  id: number;
  name: string;
  percent: number;
};

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);

  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");

  const loadDiscounts = async () => {
    const res = await fetch("/api/discounts", { cache: "no-store" });
    const json = await res.json();
    setDiscounts(json.discounts || []);
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const openModal = (d?: Discount) => {
    if (d) {
      setEditing(d);
      setName(d.name);
      setPercent(String(d.percent));
    } else {
      setEditing(null);
      setName("");
      setPercent("");
    }
    setShowModal(true);
  };

  const saveDiscount = async () => {
    const payload = {
      id: editing?.id,
      name,
      percent: Number(percent),
    };

    await fetch("/api/discounts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setShowModal(false);
    loadDiscounts();
  };

  const deleteDiscount = async (id: number) => {
    if (!confirm("Delete this discount?")) return;

    await fetch("/api/discounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadDiscounts();
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Discounts</h2>

        {/* ACCENT BUTTON */}
        <button
          onClick={() => openModal()}
          className="
            px-4 py-2 rounded-lg
            bg-[color:var(--accent)]
            hover:bg-[color:var(--accent-hover)]
          "
        >
          + Add Discount
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Percent</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-b border-slate-800">
                <td className="p-3">{d.name}</td>
                <td className="p-3">{d.percent}%</td>

                <td className="p-3 text-right space-x-3">
                  <button
                    onClick={() => openModal(d)}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteDiscount(d.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 p-6 rounded-xl w-[400px] border border-slate-700">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Edit Discount" : "Add Discount"}
            </h2>

            <div className="space-y-3">
              <input
                className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                placeholder="Discount Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
                placeholder="Percent (%)"
                type="number"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveDiscount}
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
