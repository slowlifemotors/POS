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
    permissions_level?: number;
  }>(null);

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isManagerOrAbove = (() => {
    // Prefer permissions_level if present, otherwise fall back to role
    const r = (session?.role ?? "").toLowerCase();
    if (typeof session?.permissions_level === "number") {
      return session.permissions_level >= 800;
    }
    return r === "manager" || r === "admin" || r === "owner";
  })();

  const isAdminOrOwner = (() => {
    const r = (session?.role ?? "").toLowerCase();
    return r === "admin" || r === "owner";
  })();

  const canEdit = isAdminOrOwner;

  // ---------------------------------------------------------
  // LOAD SESSION + RATES
  // ---------------------------------------------------------
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const sRes = await fetch("/api/auth/session", { cache: "no-store" });
        const sJson = await sRes.json();

        if (!alive) return;
        setSession(sJson?.staff || null);

        const rRes = await fetch("/api/settings/commission", { cache: "no-store" });
        const rJson = await rRes.json();

        if (!alive) return;

        if (!rRes.ok) {
          setRates([]);
          setErrorMsg(rJson?.error || "Failed to load commission settings.");
          return;
        }

        const list = Array.isArray(rJson?.roles) ? rJson.roles : [];
        const mapped: CommissionRate[] = list.map((x: any) => ({
          role: String(x.role ?? ""),
          rate: Number(x.rate ?? 0),
          hourly_rate: Number(x.hourly_rate ?? 0),
        }));

        setRates(mapped);
      } catch (err: any) {
        console.error("Commission settings load error:", err);
        if (!alive) return;
        setRates([]);
        setErrorMsg("Failed to load settings (check server logs).");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
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
    setErrorMsg(null);

    try {
      for (const entry of rates) {
        const res = await fetch("/api/settings/commission", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: entry.role,
            rate: entry.rate,
            hourly_rate: entry.hourly_rate,
          }),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed updating role: ${entry.role}`);
        }
      }

      alert("Settings updated successfully!");
    } catch (err: any) {
      console.error("Save changes error:", err);
      setErrorMsg(err?.message || "Failed to save changes.");
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
        Commission is calculated on <strong>profit</strong>, where profit is defined as{" "}
        <strong>(order total / 2) minus discount</strong>.
        <br />
        Hourly rates apply to all recorded work hours.
      </p>

      {errorMsg && (
        <div className="mb-6 p-3 rounded-lg border border-red-700/50 bg-red-900/20 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

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
                    min={0}
                    max={100}
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
                    min={0}
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
