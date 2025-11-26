// app/items/page.tsx
"use client";

import { useEffect, useState } from "react";

type Item = {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  barcode: string | null;
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");

  // LOAD ITEMS
  async function loadItems() {
    const res = await fetch("/api/items", { cache: "no-store" });
    const json = await res.json();
    setItems(Array.isArray(json.items) ? json.items : []);
  }

  useEffect(() => {
    loadItems();
  }, []);

  // OPEN MODAL
  const openModal = (item?: Item) => {
    if (item) {
      setEditing(item);
      setName(item.name);
      setPrice(String(item.price));
      setStock(String(item.stock));
      setCategory(item.category);
      setBarcode(item.barcode || "");
    } else {
      setEditing(null);
      setName("");
      setPrice("");
      setStock("");
      setCategory("");
      setBarcode("");
    }

    setShowModal(true);
  };

  // SAVE ITEM
  const saveItem = async () => {
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    const payload = {
      id: editing?.id,
      name,
      price: Number(price || 0),
      stock: Number(stock || 0),
      category,
      barcode: barcode || null,
    };

    const method = editing ? "PUT" : "POST";

    await fetch("/api/items", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setShowModal(false);
    loadItems();
  };

  // DELETE ITEM
  const deleteItem = async (id: number) => {
    if (!confirm("Delete this item?")) return;

    await fetch("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadItems();
  };

  // FILTERED LIST
  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.barcode || "").includes(search)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Items</h2>
        <button
          onClick={() => openModal()}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2 rounded-lg font-medium"
        >
          + Add Item
        </button>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search items..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Stock</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Barcode</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.id}
                className="border-b border-slate-800 hover:bg-slate-800"
              >
                <td className="p-3">{i.name}</td>
                <td className="p-3">${i.price}</td>
                <td className="p-3">{i.stock}</td>
                <td className="p-3">{i.category}</td>
                <td className="p-3">{i.barcode || "-"}</td>

                <td className="p-3 text-right">
                  <button
                    onClick={() => openModal(i)}
                    className="text-amber-400 hover:text-amber-300 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(i.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-slate-500 italic"
                >
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center">
          <div className="bg-slate-900 p-6 rounded-xl w-[480px] border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">
              {editing ? "Edit Item" : "Add Item"}
            </h2>

            {/* FORM */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name</label>
                <input
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">Price</label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">Stock</label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Category</label>
                <input
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Barcode</label>
                <input
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveItem}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-semibold"
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
