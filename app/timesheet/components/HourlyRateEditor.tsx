// app/timesheet/components/HourlyRateEditor.tsx
"use client";

import { useEffect, useState } from "react";

interface Role {
  id: number;
  name: string;
  hourly_rate: number;
  permission_level: number;
}

export default function HourlyRateEditor() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function loadRoles() {
    setLoading(true);

    const res = await fetch("/api/roles/hourly");
    const json = await res.json();

    if (json.roles) setRoles(json.roles);
    setLoading(false);
  }

  useEffect(() => {
    loadRoles();
  }, []);

  async function saveRate(roleId: number, newRate: number) {
    setSavingId(roleId);

    const res = await fetch("/api/roles/hourly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: roleId,
        hourly_rate: newRate,
      }),
    });

    if (!res.ok) {
      alert("Failed to update hourly rate");
    }

    setSavingId(null);
    loadRoles();
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl mb-6">
        <p className="text-slate-400">Loading hourly rates...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl mb-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-slate-50">Hourly Rates</h2>

      <table className="w-full text-slate-200">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            <th className="p-3 text-left">Role</th>
            <th className="p-3 text-left w-40">Hourly Rate</th>
            <th className="p-3 text-right">Save</th>
          </tr>
        </thead>

        <tbody>
          {roles.map((r) => (
            <tr
              key={r.id}
              className="border-b border-slate-800 hover:bg-slate-800/60 transition"
            >
              <td className="p-3 font-medium">{r.name}</td>

              <td className="p-3">
                <input
                  type="number"
                  className="bg-slate-800 border border-slate-700 rounded p-2 w-32 text-slate-50"
                  defaultValue={r.hourly_rate}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setRoles((prev) =>
                      prev.map((x) =>
                        x.id === r.id ? { ...x, hourly_rate: value } : x
                      )
                    );
                  }}
                />
              </td>

              <td className="p-3 text-right">
                <button
                  disabled={savingId === r.id}
                  onClick={() => saveRate(r.id, r.hourly_rate)}
                  className={`px-4 py-2 rounded font-medium ${
                    savingId === r.id
                      ? "bg-slate-700 text-slate-400"
                      : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                  }`}
                >
                  {savingId === r.id ? "Saving..." : "Save"}
                </button>
              </td>
            </tr>
          ))}

          {roles.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="p-4 text-center text-slate-500 italic"
              >
                No roles found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
