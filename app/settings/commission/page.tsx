// app/settings/commission/page.tsx
"use client";

import React, { useEffect, useState } from "react";

interface CommissionRate {
  role: string;
  rate: number;
  hourly_rate: number;
}

export default function CommissionSettingsPage() {
  const [session, setSession] = useState<null | {
    role: string;
    permissions_level: number;
  }>(null);

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ Discount policy settings
  const [staffDiscountAlwaysOn, setStaffDiscountAlwaysOn] = useState(false);
  const [minMonthlyHours, setMinMonthlyHours] = useState<number>(0);
  const [loadingPolicy, setLoadingPolicy] = useState(true);

  const isManagerOrAbove =
    session?.permissions_level !== undefined &&
    session.permissions_level >= 800;

  const isAdminOrOwner = session?.role === "admin" || session?.role === "owner";
  const canEdit = isAdminOrOwner;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sRes = await fetch("/api/auth/session", { cache: "no-store" });
        const sJson = await sRes.json();
        if (cancelled) return;
        setSession(sJson.staff || null);

        // discount policy
        try {
          const pRes = await fetch("/api/settings/discount-policy", {
            cache: "no-store",
          });
          const pJson = await pRes.json();
          if (!cancelled) {
            setStaffDiscountAlwaysOn(Boolean(pJson?.staff_discount_always_on));
            setMinMonthlyHours(
              Number.isFinite(Number(pJson?.staff_discount_min_monthly_hours))
                ? Number(pJson.staff_discount_min_monthly_hours)
                : 0
            );
          }
        } catch {
          // non-fatal
        } finally {
          if (!cancelled) setLoadingPolicy(false);
        }

        // existing settings page data
        const rRes = await fetch("/api/settings", { cache: "no-store" });
        if (!rRes.ok) throw new Error("Settings fetch failed.");

        const data = await rRes.json();
        if (cancelled) return;

        const merged: CommissionRate[] = data.commission_rates.map((cr: any) => {
          const hr = data.hourly_rates.find(
            (h: any) => h.role.toLowerCase() === cr.role.toLowerCase()
          );
          return {
            role: cr.role,
            rate: Number(cr.rate),
            hourly_rate: hr ? Number(hr.hourly_rate) : 0,
          };
        });

        setRates(merged);
      } catch (err) {
        console.error("Commission settings load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !isManagerOrAbove) {
    return (
      <div className="min-h-screen pt-24 px-8 text-red-400 text-xl">
        You do not have permission to view this page.
      </div>
    );
  }

  async function saveChanges() {
    if (!canEdit) return;

    setSaving(true);

    try {
      // save discount policy
      await fetch("/api/settings/discount-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_discount_always_on: staffDiscountAlwaysOn,
          staff_discount_min_monthly_hours: minMonthlyHours,
        }),
      });

      // existing per-role saves
      for (const entry of rates) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: entry.role,
            rate: entry.rate,
            hourly_rate: entry.hourly_rate,
          }),
        });
      }

      alert("Settings updated successfully!");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-8 text-slate-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      <h1 className="text-3xl font-bold mb-4 text-white">
        Commission Settings
      </h1>

      <p className="text-slate-400 mb-6">
        Commission is calculated on <strong>profit</strong>.<br />
        Hourly rates apply to all recorded work hours.
      </p>

      {/* ✅ Discount Policy */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Discount Policy</h2>
        <p className="text-slate-400 text-sm mb-4">
          If enabled, <strong>everyone gets the staff discount</strong> regardless of hours.
          If disabled, staff discount requires meeting the minimum monthly hours below.
        </p>

        {loadingPolicy ? (
          <p className="text-slate-400">Loading discount policy...</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={staffDiscountAlwaysOn}
                onChange={(e) => setStaffDiscountAlwaysOn(e.target.checked)}
                className="h-5 w-5 accent-[color:var(--accent)]"
              />
              <span className={`text-slate-200 ${!canEdit ? "opacity-50" : ""}`}>
                Always apply staff discount (ignore hours requirement)
              </span>
            </label>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-slate-200 font-semibold">
                  Minimum Monthly Hours
                </p>
                <p className="text-slate-500 text-sm">
                  Used only when “Always apply” is OFF.
                </p>
              </div>

              <input
                type="number"
                min={0}
                max={500}
                disabled={!canEdit || staffDiscountAlwaysOn}
                value={minMonthlyHours}
                onChange={(e) => setMinMonthlyHours(Number(e.target.value))}
                className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-28 outline-none text-slate-100 ${
                  !canEdit || staffDiscountAlwaysOn
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              />
            </div>

            {!canEdit && (
              <p className="text-xs text-slate-500">
                Only Admin/Owner can change this.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Existing commission/hourly table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
        <table className="w-full">
          <thead className="bg-slate-800 border-b border-slate-700 text-slate-300">
            <tr>
              <th className="py-3 px-2 text-left">Role</th>
              <th className="py-3 px-2 text-left">Commission %</th>
              <th className="py-3 px-2 text-left">Hourly Rate ($)</th>
            </tr>
          </thead>

          <tbody>
            {rates.map((r) => (
              <tr
                key={r.role}
                className="border-b border-slate-800 hover:bg-slate-800/70"
              >
                <td className="p-3 capitalize">{r.role.replace(/_/g, " ")}</td>

                <td className="p-3">
                  <input
                    type="number"
                    disabled={!canEdit}
                    className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-24 outline-none ${
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

                <td className="p-3">
                  <input
                    type="number"
                    disabled={!canEdit}
                    className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-28 outline-none ${
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
            className="
              mt-6 px-6 py-3 rounded font-semibold
              bg-[color:var(--accent)]
              hover:bg-[color:var(--accent-hover)]
              disabled:opacity-50
            "
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
