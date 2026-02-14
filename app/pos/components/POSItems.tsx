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
    const rounded = Math.round(Number(pricing_value));
    return { text: `$${rounded.toLocaleString()}`, computed: rounded };
  }

  if (pricing_type === "percentage") {
    if (vehicleBasePrice == null) {
      return { text: "Select vehicle", computed: null };
    }

    const cost = (vehicleBasePrice * Number(pricing_value)) / 100;
    const sale = Math.round(cost * 2);
    return { text: `$${sale.toLocaleString()}`, computed: sale };
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

/**
 * ✅ Flat mods that MUST be allowed even when vehicle is inactive
 */
function isAllowedFlatOnInactive(node: ModNode) {
  if (node.pricing_type !== "flat") return false;

  const name = node.name?.toLowerCase().trim();
  return (
    name === "repair" ||
    name === "repair kit" ||
    name === "screwdriver" ||
    name === "raffle ticket"
  );
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
    if (key && MENU_DEFAULT_OPEN_BY_NAME[key] !== undefined) {
      return MENU_DEFAULT_OPEN_BY_NAME[key];
    }
    return true;
  };

  const selectedInactive = Boolean(selectedVehicle && selectedVehicle.active === false);

  const renderNode = (node: ModNode, depth: number, inCosmeticsPath: boolean) => {
    const pad = indentPadding(depth);

    if (node.is_menu) {
      const fallback = defaultMenuOpen(node);
      const isOpen = openMap[node.id] ?? fallback;

      const menuKey = normalizeMenuKey(node.name);
      const nextInCosmeticsPath = inCosmeticsPath || menuKey === "cosmetics";

      return (
        <div key={node.id} className="mt-2">
          <button
            type="button"
            onClick={() => toggleMenu(node.id, isOpen)}
            className={`w-full flex items-center justify-between rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 ${pad} pr-4 py-2`}
          >
            <span className="font-semibold text-slate-50 truncate">{node.name}</span>
            <span className="text-slate-300">{isOpen ? "▾" : "▸"}</span>
          </button>

          {isOpen && (
            <div className="mt-2 space-y-2">
              {(node.children ?? []).map((child) =>
                renderNode(child, depth + 1, nextInCosmeticsPath)
              )}
            </div>
          )}
        </div>
      );
    }

    const hasVehicle = Boolean(selectedVehicle);
    const vehicleBase = hasVehicle ? Number(selectedVehicle?.base_price ?? 0) : null;

    const priceInfo = computePriceLabel(node.pricing_type, node.pricing_value, vehicleBase);

    const isFlat = node.pricing_type === "flat" && node.pricing_value != null;

    const baseCanAdd = isFlat || (hasVehicle && priceInfo.computed != null);

    /**
     * ✅ FINAL inactive rule:
     * Block ONLY if:
     * - vehicle is inactive
     * - AND not cosmetics
     * - AND not whitelisted flat mod
     */
    const blockedByInactiveRule =
      selectedInactive &&
      !inCosmeticsPath &&
      !isAllowedFlatOnInactive(node);

    const canAdd = baseCanAdd && !blockedByInactiveRule;

    return (
      <button
        key={node.id}
        type="button"
        disabled={!canAdd}
        onClick={() => onAddMod(node.id)}
        className={`w-full text-left rounded-lg border text-sm flex items-center justify-between ${pad} pr-4 py-2 ${
          canAdd
            ? "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800"
            : "bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
        }`}
        title={
          blockedByInactiveRule
            ? "Inactive vehicles can only receive Cosmetics, Repair, Repair Kit, Screwdriver, or Raffle Ticket"
            : "Add to cart"
        }
      >
        <span className="truncate">{node.name}</span>
        <span className="text-xs text-slate-400 min-w-22 text-right">
          {blockedByInactiveRule ? "Restricted" : priceInfo.text}
        </span>
      </button>
    );
  };

  const trimmedSearch = searchTerm.trim();
  const showVehicles = trimmedSearch.length > 0;

  return (
  <div className="p-0 overflow-y-auto">

      <input
        type="text"
        placeholder="Search vehicles"
        className="w-full p-3 rounded-lg mb-6 bg-slate-900 border border-slate-700 text-slate-50"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="flex gap-6 items-start">
        {/* LEFT: Vehicles */}
        <div className="w-[42%]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="font-semibold text-slate-100">Vehicles</p>
            </div>

            {!showVehicles ? (
              <div className="p-4 text-slate-500 text-sm">
                Start typing to search vehicles.
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {safeVehicles.map((v) => {
                  const isSelected = selectedVehicle?.id === v.id;
                  const isInactive = v.active === false;

                  return (
                    <div
                      key={v.id}
                      onClick={() => onSelectVehicle(v)}
                      className={`rounded-xl border cursor-pointer ${
                        isSelected
                          ? "border-(--accent) bg-slate-900"
                          : "border-slate-700 bg-slate-900/80"
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex justify-between">
                          <h2 className="font-semibold truncate">
                            {vehicleName(v)}
                          </h2>
                          {isInactive && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/40 text-amber-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-2 font-bold">
                          ${Math.round(Number(v.base_price ?? 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Mods */}
        <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl p-4">
          {modsRoot ? (
            <div className="space-y-3">
              {rootChildren.map((top) => renderNode(top, 0, false))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No mods available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
