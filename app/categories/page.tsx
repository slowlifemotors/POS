//  app/categories/page.tsx
"use client";

import React, { useEffect, useState } from "react";

// CATEGORY TYPE
type Category = {
  id: number;
  name: string;
  description: string | null;
  display_order: number | null;
  icon: string | null;
  color: string | null;
};

// Tailwind color options
const COLOR_OPTIONS = [
  { value: "rose", label: "Rose", className: "bg-rose-500" },
  { value: "sky", label: "Sky", className: "bg-sky-500" },
  { value: "emerald", label: "Emerald", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
  { value: "fuchsia", label: "Fuchsia", className: "bg-fuchsia-500" },
  { value: "pink", label: "Pink", className: "bg-pink-500" },
  { value: "cyan", label: "Cyan", className: "bg-cyan-500" },
  { value: "lime", label: "Lime", className: "bg-lime-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
  { value: "indigo", label: "Indigo", className: "bg-indigo-500" },
  { value: "red", label: "Red", className: "bg-red-500" },
  { value: "blue", label: "Blue", className: "bg-blue-500" },
  { value: "green", label: "Green", className: "bg-green-500" },
  { value: "yellow", label: "Yellow", className: "bg-yellow-500" },
  { value: "purple", label: "Purple", className: "bg-purple-500" },
];

// Emoji palette
const EMOJI_OPTIONS = [
  "🍹", "🍺", "🍷", "🥃", "🍾", "🍸", "🥂",
  "🍔", "🍕", "🌮", "🍟",
  "🥤", "🧃",
  "⭐", "🚀",
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("fuchsia");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // LOAD CATEGORIES (via API)
  const loadCategories = async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // OPEN MODAL
  const openModal = (cat?: Category) => {
    if (cat) {
      setEditing(cat);
      setName(cat.name);
      setDescription(cat.description || "");
      setDisplayOrder(cat.display_order ? String(cat.display_order) : "");
      setIcon(cat.icon || "");
      setColor(cat.color || "fuchsia");
    } else {
      setEditing(null);
      setName("");
      setDescription("");
      setDisplayOrder("");
      setIcon("");
      setColor("fuchsia");
    }
    setShowEmojiPicker(false);
    setShowModal(true);
  };

  // SAVE CATEGORY (via API)
  const saveCategory = async () => {
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    const payload = {
      id: editing?.id,
      name,
      description: description || null,
      display_order: displayOrder ? parseInt(displayOrder) : null,
      icon: icon || null,
      color: color || null,
    };

    const method = editing ? "PUT" : "POST";

    await fetch("/api/categories", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setShowModal(false);
    loadCategories();
  };

  // DELETE CATEGORY (via API)
  const deleteCategory = async (id: number) => {
    if (!confirm("Delete this category?")) return;

    await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadCategories();
  };

  // FILTERED LIST
  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const getColorClass = (value: string | null) => {
    const opt = COLOR_OPTIONS.find((c) => c.value === value);
    return opt ? opt.className : "bg-slate-600";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Categories</h2>
        <button
          onClick={() => openModal()}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2 rounded-lg font-medium"
        >
          + Add Category
        </button>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search categories..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Color</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((cat) => (
              <tr
                key={cat.id}
                className="border-b border-slate-800 hover:bg-slate-800"
              >
                <td className="p-3">{cat.display_order ?? "-"}</td>

                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {cat.icon && <span className="text-lg">{cat.icon}</span>}
                    <span className="font-semibold">{cat.name}</span>
                  </div>
                </td>

                <td className="p-3 text-slate-300">
                  {cat.description || "-"}
                </td>

                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColorClass(
                      cat.color
                    )}`}
                  >
                    {cat.color || "default"}
                  </span>
                </td>

                <td className="p-3 text-right">
                  <button
                    onClick={() => openModal(cat)}
                    className="text-amber-400 hover:text-amber-300 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
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
                  colSpan={5}
                  className="p-6 text-center text-slate-500 italic"
                >
                  No categories found.
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
              {editing ? "Edit Category" : "Add Category"}
            </h2>

            <div className="space-y-4">
              {/* NAME */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name</label>
                <input
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* ORDER + ICON */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                  />
                </div>

                {/* ICON PICKER */}
                <div className="flex-1">
                  <label className="block text-sm text-slate-300 mb-1">
                    Icon
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-2xl"
                    >
                      {icon || "😀"}
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className="mt-2 p-2 bg-slate-800 border border-slate-700 rounded grid grid-cols-8 gap-2">
                      {EMOJI_OPTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="text-xl hover:scale-110 transition"
                          onClick={() => {
                            setIcon(e);
                            setShowEmojiPicker(false);
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* COLOR */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Color
                </label>

                <div className="flex items-center gap-3">
                  <select
                    className="p-2 bg-slate-800 border border-slate-700 rounded"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  <span
                    className={`inline-block w-8 h-8 rounded-full border border-slate-700 ${getColorClass(
                      color
                    )}`}
                  />
                </div>
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
                onClick={saveCategory}
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
