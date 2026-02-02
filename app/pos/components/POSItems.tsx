// app/pos/components/POSItems.tsx
"use client";

import React from "react";
import type { Vehicle } from "../hooks/usePOS";

type ModButton = {
  key: string;
  label: string;
  percent: number;
  item_id: number | null;
};

type POSItemsProps = {
  vehicles?: Vehicle[];
  selectedVehicle: Vehicle | null;
  mods: ModButton[];

  searchTerm: string;
  setSearchTerm: (v: string) => void;

  onSelectVehicle: (v: Vehicle) => void;
  onClearVehicle: () => void;
  onAddMod: (modKey: string) => void;
};

function vehicleName(v: Vehicle) {
  const manufacturer = (v.manufacturer ?? "").trim();
  const model = (v.model ?? "").trim();
  const name = [manufacturer, model].filter(Boolean).join(" ");
  return name || `Vehicle #${v.id}`;
}

export default function POSItems({
  vehicles,
  selectedVehicle,
  mods,
  searchTerm,
  setSearchTerm,
  onSelectVehicle,
  onClearVehicle,
  onAddMod,
}: POSItemsProps) {
  const safeVehicles: Vehicle[] = Array.isArray(vehicles) ? vehicles : [];

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

      {/* Selected Vehicle + Mod Buttons */}
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

        {selectedVehicle && (
          <div className="mt-4 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {mods.map((m) => {
                const disabled = !m.item_id;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onAddMod(m.key)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      disabled
                        ? "bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                    }`}
                    title={
                      disabled
                        ? `Missing item row for "${m.label}" in items table`
                        : `${m.percent}% of base price`
                    }
                  >
                    {m.label}
                    <span className="ml-2 text-xs text-slate-400">
                      {m.percent}%
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-slate-400">
              * Each mod price is calculated as a percentage of the selected
              vehicle base price.
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
                  ? "bg-slate-900/90 border-[color:var(--accent)]"
                  : "bg-slate-900/80 backdrop-blur border-slate-700"
              }`}
            >
              <div className="p-4">
                <h2 className="font-semibold text-lg text-slate-50">
                  {vehicleName(v)}
                </h2>

                <p className="text-slate-400 text-sm">{v.category ?? "Uncategorized"}</p>

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
