// app/tabs/page.tsx
"use client";

import { useState, useEffect } from "react";

type Tab = {
  id: number;
  name: string;
  amount: number;
  active: boolean;
};

export default function TabsPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tab | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const loadTabs = async () => {
    const res = await fetch("/api/tabs", { cache: "no-store" });
    const json = await res.json();
    setTabs(json.tabs || []);
  };

  useEffect(() => { loadTabs(); }, []);

  const openModal = (tab?: Tab) => {
    if (tab) {
      setEditing(tab);
      setName(tab.name);
      setAmount(String(tab.amount));
    } else {
      setEditing(null);
      setName("");
      setAmount("");
    }
    setShowModal(true);
  };

  const saveTab = async () => {
    const payload = {
      id: editing?.id,
      name,
      amount: Number(amount),
      active: true,
    };

    await fetch("/api/tabs", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setShowModal(false);
    loadTabs();
  };

  const deleteTab = async (id: number) => {
    if (!confirm("Delete this tab?")) return;

    await fetch(`/api/tabs?id=${id}`, { method: "DELETE" });
    loadTabs();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8">

      <div className="flex justify-between mb-6">
        <h2 className="text-3xl font-bold">Tabs</h2>

        <button
          onClick={() => openModal()}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2 rounded-lg"
        >
          + Add Tab
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {tabs.map((t) => (
              <tr key={t.id} className="border-b border-slate-800">
                <td className="p-3">{t.name}</td>
                <td className="p-3">${t.amount.toLocaleString()}</td>
                <td className="p-3">{t.active ? "Yes" : "No"}</td>

                <td className="p-3 text-right space-x-3">
                  <button
                    onClick={() => openModal(t)}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteTab(t.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {tabs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  No tabs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center">
          <div className="bg-slate-900 p-6 rounded-xl w-[400px] border border-slate-700">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Edit Tab" : "Add Tab"}
            </h2>

            <div className="space-y-3">
              <input
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                placeholder="Tab Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                type="number"
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveTab}
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
