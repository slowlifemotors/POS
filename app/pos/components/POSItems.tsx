// app/pos/components/POSItems.tsx
"use client";

import React from "react";

type Item = {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  category: string;
};

type POSItemsProps = {
  items?: Item[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  addToCart: (item: Item) => void;
};

export default function POSItems({
  items,
  searchTerm,
  setSearchTerm,
  addToCart,
}: POSItemsProps) {
  const safeItems: Item[] = Array.isArray(items) ? items : [];

  const filteredItems = safeItems.filter((item) => {
    const s = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(s) ||
      item.category.toLowerCase().includes(s) ||
      (item.barcode && item.barcode.includes(searchTerm))
    );
  });

  return (
    <div className="flex-1 pt-24 p-6 overflow-y-auto">
      {/* Search */}
      <input
        type="text"
        placeholder="Search vehicles"
        className="w-full p-3 rounded-lg mb-6 bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-400"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Items grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => addToCart(item)}
            className="bg-slate-900 rounded-xl border border-slate-700 cursor-pointer hover:scale-[1.02] transition"
          >
            <div className="p-4">
              <h2 className="font-semibold text-lg">{item.name}</h2>
              <p className="text-slate-400 text-sm">{item.category}</p>
              <p className="mt-2 text-xl font-bold">
                ${item.price.toFixed(2)}
              </p>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <p className="text-slate-500 col-span-full text-center mt-10">
            No vehicles found.
          </p>
        )}
      </div>
    </div>
  );
}
