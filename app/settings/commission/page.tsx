"use client";

import React, { useEffect, useState } from "react";

interface CommissionRate {
  role: string;
  rate: number;
  hourly_rate: number; // NEW FIELD
}

export default function CommissionSettingsPage() {
  const [session, setSession] = useState<null | {
    role: string;
    permissions_level: number;
  }>(null);

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isManagerOrAbove =
    session?.permissions_level !== undefined &&
    session.permissions_level >= 800;

  const isAdminOrOwner =
    session?.role === "admin" || session?.role === "owner";

  // ---------------------------------------------------------
  // LOAD SESSION + COMMISSION + HOURLY RATES
  // ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      // Load session
      const sRes = await fetch("/api/auth/session", { cache: "no-store" });
      const sJson = await sRes.json();
      setSession(sJson.staff || null);

      // Load commission + hourly rates
      const rRes = await fetch("/api/settings", { cache: "no-store" });
      const data = await rRes.json();

      // Merge commission + hourly into one dataset
      const merged: CommissionRate[] = data.commission_rates.map((cr: any) => {
        const hr = data.hourly_rates.find(
          (h: any) => h.role.toLowerCase() === cr.role.toLowerCase()
        );
        return {
          role: cr.role,
          rate: cr.rate,
          hourly_rate: hr ? hr.hourly_rate : 0,
        };
      });

      setRates(merged);
      setLoading(false);
    }

    load();
  }, []);

  // ---------------------------------------------------------
  // PERMISSION GUARD
  // ONLY Admin, Owner, Manager can view
  // ---------------------------------------------------------
  if (!loading && !isManagerOrAbove) {
    return (
      <div className="min-h-screen pt-24 p-10 text-red-400 text-xl">
        You do not have permission to view this page.
      </div>
    );
  }

  const canEdit = isAdminOrOwner; // Manager can view only

  // ---------------------------------------------------------
  // SAVE CHANGES — updates BOTH commission + hourly
  // ---------------------------------------------------------
  async function saveChanges() {
    if (!canEdit) return;

    setSaving(true);

    for (const entry of rates) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: entry.role,
          rate: entry.rate,
          hourly_rate: entry.hourly_rate, // NEW
        }),
      });
    }

    setSaving(false);
    alert("Settings updated successfully!");
  }

  if (loading)
    return (
      <div className="min-h-screen pt-24 p-10 text-slate-300">Loading...</div>
    );

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen pt-24 p-10 max-w-4xl mx-auto text-slate-100">
      <h1 className="text-3xl font-bold mb-4 text-fuchsia-500">
        Commission Settings
      </h1>

      <p className="text-slate-400 mb-6">
        Commission is based on <strong>profit (price − cost_price)</strong>.
        <br />
        Hourly rates apply to all timeclock hours.
      </p>

      <div className="bg-slate-900 rounded-lg border border-slate-700 p-6">
        <table className="w-full">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-3">Role</th>
              <th className="py-3">Commission %</th>
              <th className="py-3">Hourly Rate ($)</th>
            </tr>
          </thead>

          <tbody>
            {rates.map((r) => (
              <tr key={r.role} className="border-b border-slate-800">
                <td className="py-3 capitalize">{r.role.replace(/_/g, " ")}</td>

                {/* Commission % */}
                <td className="py-3">
                  <input
                    type="number"
                    disabled={!canEdit}
                    className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-24 ${
                      !canEdit ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    value={r.rate}
                    onChange={(e) => {
                      const updated = rates.map((x) =>
                        x.role === r.role
                          ? { ...x, rate: Number(e.target.value) }
                          : x
                      );
                      setRates(updated);
                    }}
                  />
                </td>

                {/* Hourly Rate */}
                <td className="py-3">
                  <input
                    type="number"
                    disabled={!canEdit}
                    className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-28 ${
                      !canEdit ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    value={r.hourly_rate}
                    onChange={(e) => {
                      const updated = rates.map((x) =>
                        x.role === r.role
                          ? { ...x, hourly_rate: Number(e.target.value) }
                          : x
                      );
                      setRates(updated);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {canEdit && (
          <button
            onClick={saveChanges}
            disabled={saving}
            className="mt-6 bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded text-white"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
