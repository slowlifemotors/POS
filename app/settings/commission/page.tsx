// app/settings/commission/page.tsx
"use client";

import React, { useEffect, useState } from "react";

interface CommissionRate {
  role: string;
  rate: number;
  hourly_rate: number;
}

type SessionStaff = {
  id?: number;
  username?: string;
  name?: string;
  role: string;
  permissions_level: number;
};

export default function CommissionSettingsPage() {
  const [session, setSession] = useState<SessionStaff | null>(null);

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Discount policy settings
  const [staffDiscountAlwaysOn, setStaffDiscountAlwaysOn] = useState(false);
  const [minMonthlyHours, setMinMonthlyHours] = useState<number>(0);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const isManagerOrAbove =
    session?.permissions_level !== undefined &&
    Number(session.permissions_level) >= 800;

  const isAdminOrOwner = (() => {
    const r = (session?.role ?? "").toLowerCase().trim();
    return r === "admin" || r === "owner";
  })();

  const canEdit = isAdminOrOwner;

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setLoadError(null);

      // Always resolve loading states (prevents infinite "Loading...")
      try {
        // 1) Session
        const sRes = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });

        const sJson = await sRes.json().catch(() => ({}));

        if (cancelled) return;

        // Your /api/auth/session returns: { staff: ... }
        setSession((sJson?.staff as SessionStaff) ?? null);

        // 2) Discount policy (non-fatal)
        setLoadingPolicy(true);
        setPolicyError(null);
        try {
          const pRes = await fetch("/api/settings/discount-policy", {
            cache: "no-store",
            credentials: "include",
          });

          // If endpoint missing or forbidden, don’t block the whole page
          if (!pRes.ok) {
            const t = await pRes.text().catch(() => "");
            throw new Error(`Discount policy fetch failed (${pRes.status}) ${t}`);
          }

          const pJson = await pRes.json().catch(() => ({}));
          if (!cancelled) {
            setStaffDiscountAlwaysOn(Boolean(pJson?.staff_discount_always_on));
            setMinMonthlyHours(
              Number.isFinite(Number(pJson?.staff_discount_min_monthly_hours))
                ? Number(pJson.staff_discount_min_monthly_hours)
                : 0
            );
          }
        } catch (e: any) {
          if (!cancelled) {
            setPolicyError(e?.message || "Failed to load discount policy.");
          }
        } finally {
          if (!cancelled) setLoadingPolicy(false);
        }

        // 3) Commission + hourly rates (non-fatal but should populate table)
        const rRes = await fetch("/api/settings", {
          cache: "no-store",
          credentials: "include",
        });

        if (!rRes.ok) {
          const t = await rRes.text().catch(() => "");
          throw new Error(`Settings fetch failed (${rRes.status}) ${t}`);
        }

        const data = await rRes.json().catch(() => ({}));
        if (cancelled) return;

        const commissionRates = Array.isArray(data?.commission_rates)
          ? data.commission_rates
          : [];

        const hourlyRates = Array.isArray(data?.hourly_rates) ? data.hourly_rates : [];

        const merged: CommissionRate[] = commissionRates.map((cr: any) => {
          const role = String(cr?.role ?? "");
          const hr = hourlyRates.find(
            (h: any) => String(h?.role ?? "").toLowerCase() === role.toLowerCase()
          );

          return {
            role,
            rate: Number(cr?.rate ?? 0),
            hourly_rate: hr ? Number(hr?.hourly_rate ?? 0) : 0,
          };
        });

        setRates(merged);
      } catch (err: any) {
        console.error("Commission settings load failed:", err);
        if (!cancelled) setLoadError(err?.message || "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-8 text-slate-300">
        Loading...
      </div>
    );
  }

  // If session didn't load, show a clear message instead of looping
  if (!session) {
    return (
      <div className="min-h-screen pt-24 px-8 text-red-400">
        Not authenticated. Please log in again.
      </div>
    );
  }

  if (!isManagerOrAbove) {
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
      // Save discount policy (best effort)
      await fetch("/api/settings/discount-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          staff_discount_always_on: staffDiscountAlwaysOn,
          staff_discount_min_monthly_hours: Math.max(0, Number(minMonthlyHours) || 0),
        }),
      });

      // Save per-role commission + hourly rates
      for (const entry of rates) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            role: entry.role,
            rate: Number(entry.rate) || 0,
            hourly_rate: Number(entry.hourly_rate) || 0,
          }),
        });
      }

      alert("Settings updated successfully!");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 px-8 text-slate-100">
      <h1 className="text-3xl font-bold mb-2 text-white">Commission Settings</h1>

      <p className="text-slate-400 mb-6">
        Commission is calculated on <strong>profit</strong>.
        <br />
        Hourly rates apply to all recorded work hours.
      </p>

      {loadError && (
        <div className="mb-6 p-3 rounded-lg border border-red-700/50 bg-red-900/20 text-red-200 text-sm">
          {loadError}
        </div>
      )}

      {/* Discount Policy */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Discount Policy</h2>
        <p className="text-slate-400 text-sm mb-4">
          If enabled, <strong>everyone gets the staff discount</strong> regardless of hours.
          If disabled, staff discount requires meeting the minimum monthly hours below.
        </p>

        {loadingPolicy ? (
          <p className="text-slate-400">Loading discount policy...</p>
        ) : policyError ? (
          <p className="text-amber-300 text-sm">
            {policyError}
          </p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={staffDiscountAlwaysOn}
                onChange={(e) => setStaffDiscountAlwaysOn(e.target.checked)}
                className="h-5 w-5 accent-(--accent)"
              />
              <span className={`text-slate-200 ${!canEdit ? "opacity-50" : ""}`}>
                Always apply staff discount (ignore hours requirement)
              </span>
            </label>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-slate-200 font-semibold">Minimum Monthly Hours</p>
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

      {/* Commission/Hourly table */}
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
                    min={0}
                    max={100}
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
                    min={0}
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
              bg-(--accent)
              hover:bg-(--accent-hover)
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
