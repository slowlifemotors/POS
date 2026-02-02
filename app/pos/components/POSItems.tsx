// app/pos/components/POSItems.tsx
"use client";

import React, { useMemo, useState } from "react";
import type { Vehicle, ModNode, ModPricingType } from "../hooks/usePOS";

type POSItemsProps = {
  vehicles?: Vehicle[];
  selectedVehicle: Vehicle | null;
  modsRoot: ModNode | null;

  searchTerm: string;
  setSearchTerm: (v: string) => void;

  onSelectVehicle: (v: Vehicle) => void;
  onClearVehicle: () => void;

  onAddMod: (modId: string) => void;
};

function vehicleName(v: Vehicle) {
  const manufacturer = (v.manufacturer ?? "").trim();
  const model = (v.model ?? "").trim();
  const name = [manufacturer, model].filter(Boolean).join(" ");
  return name || `Vehicle #${v.id}`;
}

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Pricing display rule:
 * - percentage value is COST (% of base price)
 * - sale price = cost * 2 (100% markup)
 * - flat value is already the SALE price
 */
function computePriceLabel(
  pricing_type: ModPricingType | null,
  pricing_value: number | null,
  vehicleBasePrice: number
) {
  if (!pricing_type || pricing_value == null) return { text: "No price", computed: null };

  if (pricing_type === "percentage") {
    const pct = Number(pricing_value);
    const cost = roundToCents((vehicleBasePrice * pct) / 100);
    const sale = roundToCents(cost * 2);
    return { text: `${pct.toFixed(2)}% ($${sale.toFixed(2)})`, computed: sale };
  }

  const sale = roundToCents(Number(pricing_value));
  return { text: `$${sale.toLocaleString()}`, computed: sale };
}

export default function POSItems({
  vehicles,
  selectedVehicle,
  modsRoot,
  searchTerm,
  setSearchTerm,
  onSelectVehicle,
  onClearVehicle,
  onAddMod,
}: POSItemsProps) {
  const safeVehicles: Vehicle[] = Array.isArray(vehicles) ? vehicles : [];

  // Collapsible menus: id -> open (default true)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const rootChildren = useMemo(() => {
    if (!modsRoot) return [];
    return Array.isArray(modsRoot.children) ? modsRoot.children : [];
  }, [modsRoot]);

  const toggleMenu = (id: string) => {
    setOpenMap((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  };

  const renderNode = (node: ModNode, depth: number) => {
    const isOpen = openMap[node.id] !== false; // default open
    const indentClass = depth === 0 ? "" : depth === 1 ? "ml-4" : "ml-8";

    if (node.is_menu) {
      return (
        <div key={node.id} className={`${indentClass} mt-2`}>
          <button
            type="button"
            onClick={() => toggleMenu(node.id)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
          >
            <span className="font-semibold text-slate-50">{node.name}</span>
            <span className="text-slate-300">{isOpen ? "▾" : "▸"}</span>
          </button>

          {isOpen && (
            <div className="mt-2 space-y-2">
              {(node.children ?? []).map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf mod button
    const base = selectedVehicle?.base_price ?? 0;
    const priceInfo = computePriceLabel(node.pricing_type, node.pricing_value, base);
    const disabled = !selectedVehicle || priceInfo.computed == null;

    return (
      <button
        key={node.id}
        type="button"
        disabled={disabled}
        onClick={() => onAddMod(node.id)}
        className={`${indentClass} w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition flex items-center justify-between ${
          disabled
            ? "bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800"
        }`}
        title={
          !selectedVehicle
            ? "Select a vehicle first"
            : priceInfo.computed == null
              ? `No pricing set for "${node.name}" (set in /mods)`
              : "Add to cart"
        }
      >
        <span className="text-slate-100">{node.name}</span>
        <span className="text-xs text-slate-400">{priceInfo.text}</span>
      </button>
    );
  };

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

      {/* Selected Vehicle + Mod Menus */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              {selectedVehicle ? "Selected Vehicle" : "Select a Vehicle"}
            </h2>
            {selectedVehicle ? (
              <p className="text-slate-300 text-sm">
                {vehicleName(selectedVehicle)} —{" "}
                <span className="text-slate-200 font-semibold">
                  ${Number(selectedVehicle.base_price ?? 0).toFixed(2)}
                </span>
              </p>
            ) : (
              <p className="text-slate-400 text-sm">
                Click a vehicle below to show available mods.
              </p>
            )}
          </div>

          {selectedVehicle && (
            <button
              type="button"
              onClick={onClearVehicle}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 transition"
            >
              Change Vehicle
            </button>
          )}
        </div>

        {/* MOD MENUS (only after selecting vehicle) */}
        {selectedVehicle && (
          <div className="mt-4 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-4">
            {!modsRoot && (
              <p className="text-slate-400 text-sm">
                No mods available. Make sure the mods table is seeded and active.
              </p>
            )}

            {modsRoot && (
              <div className="space-y-3">
                {rootChildren.map((top) => renderNode(top, 0))}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              * Percentage mods: % is COST basis; sale price includes 100% markup.
            </p>
          </div>
        )}
      </div>

      {/* Vehicles grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {safeVehicles.map((v) => {
          const isSelected = selectedVehicle?.id === v.id;

          return (
            <div
              key={v.id}
              onClick={() => onSelectVehicle(v)}
              className={`rounded-xl border cursor-pointer hover:scale-[1.02] transition ${
                isSelected
                  ? "bg-slate-900/90 border-(--accent)"
                  : "bg-slate-900/80 backdrop-blur border-slate-700"
              }`}
            >
              <div className="p-4">
                <h2 className="font-semibold text-lg text-slate-50">
                  {vehicleName(v)}
                </h2>

                <p className="text-slate-400 text-sm">
                  {v.category ?? "Uncategorized"}
                </p>

                {(v.stock_class || v.maxed_class) && (
                  <p className="text-slate-400 text-xs mt-1">
                    {v.stock_class ? `Stock: ${v.stock_class}` : ""}
                    {v.stock_class && v.maxed_class ? " • " : ""}
                    {v.maxed_class ? `Maxed: ${v.maxed_class}` : ""}
                  </p>
                )}

                <p className="mt-2 text-xl font-bold text-slate-50">
                  ${Number(v.base_price ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}

        {safeVehicles.length === 0 && (
          <p className="text-slate-500 col-span-full text-center mt-10">
            No vehicles found.
          </p>
        )}
      </div>
    </div>
  );
}
