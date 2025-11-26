// app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

// Must match /api/auth/session normalized output
type SessionStaff = {
  id: number;
  name: string;
  username: string;
  role: string;
  role_id: number;
  role_name: string;
  permissions_level: number;
  commission_rate: number;
};

export default function SettingsPage() {
  const [staff, setStaff] = useState<SessionStaff | null>(null);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------
  // LOAD SESSION
  // -------------------------------------------------------
  useEffect(() => {
    async function load() {
      const sessionRes = await fetch("/api/auth/session", {
        cache: "no-store",
      });
      const sessionData = await sessionRes.json();
      setStaff(sessionData.staff || null);

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center text-slate-50">
        Loading settings...
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex justify-center items-center text-slate-50">
        Not authenticated
      </div>
    );
  }

  // -------------------------------------------------------
  // PERMISSION LOGIC — Admin + Owner ONLY
  // Admin = 1000
  // Owner = 900
  // -------------------------------------------------------
  const isAdminOrOwner = staff.permissions_level >= 900;

  if (!isAdminOrOwner) {
    return (
      <div className="min-h-screen flex justify-center items-center text-red-400 text-xl pt-24">
        You do not have permission to view Settings.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pt-24 px-8 max-w-3xl mx-auto space-y-10">

        {/* ---------------------------------------------------
           PROFILE
        --------------------------------------------------- */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Your Profile</h2>

          <div className="space-y-3">
            <p><span className="text-slate-400">Name:</span> {staff.name}</p>
            <p><span className="text-slate-400">Role:</span> {staff.role}</p>
            <p><span className="text-slate-400">Username:</span> {staff.username}</p>
          </div>
        </div>

        {/* ---------------------------------------------------
           BUSINESS SETTINGS
        --------------------------------------------------- */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Business Settings</h2>

          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-1">
              Business Name
            </label>
            <input
              defaultValue="Galaxy Nightclub"
              disabled
              className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-1">Theme</label>
            <select
              defaultValue="dark"
              disabled
              className="p-2 bg-slate-800 border border-slate-700 rounded"
            >
              <option value="dark">Dark (Recommended)</option>
              <option value="light">Light (Not ready)</option>
            </select>
          </div>

          <div>
            <p className="text-sm text-slate-300 mb-2">Business Logo</p>
            <div className="w-20 h-20 bg-slate-800 border border-slate-700 flex items-center justify-center rounded-lg">
              <Image src="/logo.png" width={60} height={60} alt="logo" />
            </div>
            <p className="text-xs mt-2 text-slate-400 italic">
              Replace <code>/public/logo.png</code> to update logo
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------
           DATA TOOLS
        --------------------------------------------------- */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Data Tools</h2>

          <button
            onClick={async () => {
              const res = await fetch("/api/export/csv");

              if (!res.ok) {
                alert("Failed to export POS data");
                return;
              }

              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "pos_export.csv";
              a.click();
              window.URL.revokeObjectURL(url);
            }}
            className="w-full bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-md font-semibold"
          >
            Export POS Data → CSV
          </button>
        </div>

        {/* ---------------------------------------------------
           LOGOUT
        --------------------------------------------------- */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg text-center">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-md text-lg font-semibold"
            >
              Logout
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
