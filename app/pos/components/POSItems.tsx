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

/**
 * Pricing display rule:
 * - percentage value is COST (% of base price)
 * - sale price = cost * 2 (100% markup)
 * - flat value is already the SALE price
 * - rounded to nearest dollar
 *
 * IMPORTANT:
 * - If no vehicle selected:
 *    - percentage mods can't be computed -> "Select vehicle"
 *    - flat mods can be computed -> show price
 */
function computePriceLabel(
  pricing_type: ModPricingType | null,
  pricing_value: number | null,
  vehicleBasePrice: number | null
) {
  if (!pricing_type || pricing_value == null) {
    return { text: "No price", computed: null };
  }

  if (pricing_type === "flat") {
    const sale = Number(pricing_value);
    const rounded = Math.round(sale);
    return {
      text: `$${rounded.toLocaleString()}`,
      computed: rounded,
    };
  }

  if (pricing_type === "percentage") {
    if (vehicleBasePrice == null) {
      return { text: "Select vehicle", computed: null };
    }

    const pct = Number(pricing_value);
    const cost = (vehicleBasePrice * pct) / 100;
    const sale = cost * 2;
    const rounded = Math.round(sale);

    return {
      text: `$${rounded.toLocaleString()}`,
      computed: rounded,
    };
  }

  return { text: "No price", computed: null };
}

const MENU_DEFAULT_OPEN_BY_NAME: Record<string, boolean> = {
  cosmetics: false,
  upgrades: true,
  mods: true,
  "frequently used": true,
};

function normalizeMenuKey(name: unknown) {
  return typeof name === "string" ? name.toLowerCase().trim() : "";
}

function indentPadding(depth: number) {
  if (depth <= 0) return "pl-4";
  if (depth === 1) return "pl-8";
  return "pl-12";
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

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const rootChildren = useMemo(() => {
    if (!modsRoot) return [];
    return Array.isArray(modsRoot.children) ? modsRoot.children : [];
  }, [modsRoot]);

  const toggleMenu = (id: string, fallbackCurrent: boolean) => {
    setOpenMap((prev) => {
      const current = prev[id] !== undefined ? prev[id] : fallbackCurrent;
      return { ...prev, [id]: !current };
    });
  };

  const defaultMenuOpen = (node: ModNode) => {
    const key = normalizeMenuKey(node.name);
    if (key && Object.prototype.hasOwnProperty.call(MENU_DEFAULT_OPEN_BY_NAME, key)) {
      return MENU_DEFAULT_OPEN_BY_NAME[key];
    }
    return true;
  };

  const selectedInactive = Boolean(selectedVehicle && selectedVehicle.active === false);

  const renderNode = (node: ModNode, depth: number, inCosmeticsPath: boolean) => {
    const pad = indentPadding(depth);

    if (node.is_menu) {
      const fallback = defaultMenuOpen(node);
      const isOpen = openMap[node.id] !== undefined ? openMap[node.id] : fallback;

      const menuKey = normalizeMenuKey(node.name);
      const nextInCosmeticsPath = inCosmeticsPath || menuKey === "cosmetics";

      return (
        <div key={node.id} className="mt-2">
          <button
            type="button"
            onClick={() => toggleMenu(node.id, isOpen)}
            className={`w-full flex items-center justify-between rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition overflow-hidden ${pad} pr-4 py-2`}
          >
            <span className="font-semibold text-slate-50 truncate">{node.name}</span>
            <span className="text-slate-300 shrink-0">{isOpen ? "▾" : "▸"}</span>
          </button>

          {isOpen && (
            <div className="mt-2 space-y-2">
              {(node.children ?? []).map((child) => renderNode(child, depth + 1, nextInCosmeticsPath))}
            </div>
          )}
        </div>
      );
    }

    const hasVehicle = Boolean(selectedVehicle);
    const vehicleBase = hasVehicle ? Number(selectedVehicle?.base_price ?? 0) : null;

    const priceInfo = computePriceLabel(node.pricing_type, node.pricing_value, vehicleBase);

    const isFlat = node.pricing_type === "flat" && node.pricing_value != null;

    // Base add rules:
    // - Flat mods can be added even without a vehicle (usePOS will further restrict which ones)
    // - Percentage mods require a vehicle
    const baseCanAdd = isFlat || (hasVehicle && priceInfo.computed != null);

    // Inactive vehicle restriction:
    const blockedByInactiveRule = selectedInactive && !inCosmeticsPath;

    const canAdd = baseCanAdd && !blockedByInactiveRule;
    const disabled = !canAdd;

    const title = disabled
      ? blockedByInactiveRule
        ? "Inactive vehicles can only receive Cosmetics changes"
        : node.pricing_type === "percentage"
          ? "Select a vehicle to price percentage mods"
          : `No pricing set for "${node.name}" (set in /mods)`
      : "Add to cart";

    return (
      <button
        key={node.id}
        type="button"
        disabled={disabled}
        onClick={() => onAddMod(node.id)}
        className={`w-full text-left rounded-lg border text-sm font-medium transition flex items-center justify-between overflow-hidden ${pad} pr-4 py-2 ${
          disabled
            ? "bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800"
        }`}
        title={title}
      >
        <span className="text-slate-100 truncate">{node.name ?? "Mod"}</span>
        <span className="text-xs text-slate-400 tabular-nums shrink-0 text-right min-w-22">
          {blockedByInactiveRule ? "Cosmetics only" : priceInfo.text}
        </span>
      </button>
    );
  };

  const trimmedSearch = searchTerm.trim();
  const showVehicles = trimmedSearch.length > 0;

  return (
    <div className="pt-24 p-6 overflow-y-auto">
      {/* Search */}
      <input
        type="text"
        placeholder="Search vehicles"
        className="w-full p-3 rounded-lg mb-6 bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-400"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* 2-column layout */}
      <div className="flex gap-6 items-start">
        {/* LEFT: Vehicles (only when searching) */}
        <div className="w-[42%]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <p className="font-semibold text-slate-100">Vehicles</p>
              {!showVehicles && <p className="text-xs text-slate-500">Type to search</p>}
            </div>

            {!showVehicles ? (
              <div className="p-4 text-slate-500 text-sm">Start typing to search vehicles.</div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {safeVehicles.length === 0 ? (
                  <p className="text-slate-500 col-span-full text-center">No vehicles found.</p>
                ) : (
                  safeVehicles.map((v) => {
                    const isSelected = selectedVehicle?.id === v.id;
                    const isInactive = v.active === false;

                    return (
                      <div
                        key={v.id}
                        onClick={() => onSelectVehicle(v)}
                        className={`rounded-xl border cursor-pointer hover:scale-[1.01] transition ${
                          isSelected
                            ? "bg-slate-900/90 border-(--accent)"
                            : "bg-slate-900/80 backdrop-blur border-slate-700"
                        } ${isInactive ? "opacity-90" : ""}`}
                        title={isInactive ? "Inactive vehicle — Cosmetics only" : "Active vehicle"}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-semibold text-slate-50 truncate">{vehicleName(v)}</h2>
                            {isInactive && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/40 text-amber-200 shrink-0">
                                Inactive
                              </span>
                            )}
                          </div>

                          <p className="text-slate-400 text-xs">{v.category ?? "Uncategorized"}</p>

                          <p className="mt-2 text-base font-bold text-slate-50">
                            ${Math.round(Number(v.base_price ?? 0)).toLocaleString()}
                          </p>

                          {isInactive && (
                            <p className="mt-1 text-[11px] text-amber-200/80">Cosmetics only</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Selected Vehicle + Mods */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                {selectedVehicle ? "Selected Vehicle" : "No Vehicle Selected"}
              </h2>

              {selectedVehicle ? (
                <p className="text-slate-300 text-sm">
                  {vehicleName(selectedVehicle)} —{" "}
                  <span className="text-slate-200 font-semibold">
                    ${Math.round(Number(selectedVehicle.base_price ?? 0)).toLocaleString()}
                  </span>{" "}
                  {selectedVehicle.active ? (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/40 text-emerald-200">
                      Active
                    </span>
                  ) : (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/40 text-amber-200">
                      Inactive (Cosmetics only)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-slate-400 text-sm">
                  Flat-priced items can still be sold (e.g. Repair / Repair Kit / Screwdriver).
                </p>
              )}
            </div>

            {selectedVehicle && (
              <button
                type="button"
                onClick={onClearVehicle}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 transition"
              >
                Clear Vehicle
              </button>
            )}
          </div>

          <div className="w-full bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-4 overflow-hidden">
            {!modsRoot && (
              <p className="text-slate-400 text-sm">
                No mods available. Make sure the mods table is seeded and active.
              </p>
            )}

            {modsRoot && (
              <div className="space-y-3">{rootChildren.map((top) => renderNode(top, 0, false))}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
