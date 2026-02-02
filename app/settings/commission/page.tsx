// app/settings/commission/page.tsx
"use client";

import React, { useEffect, useState } from "react";

interface CommissionRoleRow {
  id: number;
  role: string; // lowercased role name from API
  rate: number; // commission %
  hourly_rate: number; // hourly $
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

  const [roles, setRoles] = useState<CommissionRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Discount policy settings
  const [staffDiscountAlwaysOn, setStaffDiscountAlwaysOn] = useState(false);
  const [minMonthlyHours, setMinMonthlyHours] = useState<number>(0);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const isManagerOrAbove =
    session?.permissions_level !== undefined && Number(session.permissions_level) >= 800;

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

      try {
        // 1) Session
        const sRes = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });

        const sJson = await sRes.json().catch(() => ({}));
        if (cancelled) return;

        setSession((sJson?.staff as SessionStaff) ?? null);

        // 2) Discount policy (non-fatal)
        setLoadingPolicy(true);
        setPolicyError(null);
        try {
          const pRes = await fetch("/api/settings/discount-policy", {
            cache: "no-store",
            credentials: "include",
          });

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
          if (!cancelled) setPolicyError(e?.message || "Failed to load discount policy.");
        } finally {
          if (!cancelled) setLoadingPolicy(false);
        }

        // 3) Commission + hourly (THIS is the correct endpoint)
        const rRes = await fetch("/api/settings/commission", {
          cache: "no-store",
          credentials: "include",
        });

        if (!rRes.ok) {
          const t = await rRes.text().catch(() => "");
          throw new Error(`Commission fetch failed (${rRes.status}) ${t}`);
        }

        const rJson = await rRes.json().catch(() => ({}));
        if (cancelled) return;

        const list = Array.isArray(rJson?.roles) ? rJson.roles : [];
        const normalized: CommissionRoleRow[] = list.map((x: any) => ({
          id: Number(x?.id),
          role: String(x?.role ?? "").toLowerCase(),
          rate: Number(x?.rate ?? 0),
          hourly_rate: Number(x?.hourly_rate ?? 0),
        }));

        setRoles(normalized);
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
    return <div className="min-h-screen pt-24 px-8 text-slate-300">Loading...</div>;
  }

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

      // Save per-role commission + hourly rates (correct endpoint)
      for (const entry of roles) {
        const res = await fetch("/api/settings/commission", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            role: entry.role,
            rate: Number(entry.rate) || 0,
            hourly_rate: Number(entry.hourly_rate) || 0,
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Save failed for ${entry.role} (${res.status}) ${t}`);
        }
      }

      alert("Settings updated successfully!");
    } catch (e: any) {
      console.error("Commission save failed:", e);
      alert(e?.message || "Failed to save changes");
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
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 mb-6 shadow-lg backdrop-blur">
        <h2 className="text-xl font-bold text-white mb-2">Discount Policy</h2>
        <p className="text-slate-400 text-sm mb-4">
          If enabled, <strong>everyone gets the staff discount</strong> regardless of hours.
          If disabled, staff discount requires meeting the minimum monthly hours below.
        </p>

        {loadingPolicy ? (
          <p className="text-slate-400">Loading discount policy...</p>
        ) : policyError ? (
          <p className="text-amber-300 text-sm">{policyError}</p>
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
                <p className="text-slate-500 text-sm">Used only when “Always apply” is OFF.</p>
              </div>

              <input
                type="number"
                min={0}
                max={500}
                disabled={!canEdit || staffDiscountAlwaysOn}
                value={minMonthlyHours}
                onChange={(e) => setMinMonthlyHours(Number(e.target.value))}
                className={`bg-slate-800 px-3 py-2 rounded border border-slate-700 w-28 outline-none text-slate-100 ${
                  !canEdit || staffDiscountAlwaysOn ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {!canEdit && (
              <p className="text-xs text-slate-500">Only Admin/Owner can change this.</p>
            )}
          </div>
        )}
      </div>

      {/* Commission/Hourly table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg backdrop-blur">
        <table className="w-full">
          <thead className="bg-slate-800/70 border-b border-slate-700 text-slate-300">
            <tr>
              <th className="py-3 px-2 text-left">Role</th>
              <th className="py-3 px-2 text-left">Commission %</th>
              <th className="py-3 px-2 text-left">Hourly Rate ($)</th>
            </tr>
          </thead>

          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40">
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
                      const next = roles.map((x) =>
                        x.id === r.id ? { ...x, rate: Number(e.target.value) } : x
                      );
                      setRoles(next);
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
                      const next = roles.map((x) =>
                        x.id === r.id ? { ...x, hourly_rate: Number(e.target.value) } : x
                      );
                      setRoles(next);
                    }}
                  />
                </td>
              </tr>
            ))}

            {roles.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-slate-400">
                  No roles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canEdit && (
          <button
            onClick={saveChanges}
            disabled={saving}
            className="mt-6 px-6 py-3 rounded font-semibold bg-(--accent) hover:bg-(--accent-hover) disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}

        {!canEdit && (
          <p className="mt-4 text-xs text-slate-500">Only Admin/Owner can edit commission/hourly.</p>
        )}
      </div>
    </div>
  );
}
