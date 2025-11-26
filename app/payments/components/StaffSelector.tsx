// app/payments/components/StaffSelector.tsx
"use client";

import React, { useEffect, useState } from "react";

type Staff = {
  id: number;
  name: string;
  role: string;
};

export default function StaffSelector({
  session,
  selectedStaffId,
  onSelect,
}: {
  session: any;
  selectedStaffId: number | null;
  onSelect: (id: number) => void;
}) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Normalize session role + id
  const userRole = session?.role?.toLowerCase?.() || "";
  const userId =
    session?.id || session?.staff_id || session?.staff?.id || null;

  const isPrivileged = ["admin", "owner", "manager"].includes(userRole);

  // Load staff based on permissions
  const loadStaff = async () => {
    if (!session || !userId) return;

    setLoading(true);

    // Non-privileged users can only select themselves
    if (!isPrivileged) {
      const self: Staff = {
        id: userId,
        name: session.name,
        role: session.role,
      };
      setStaffList([self]);
      onSelect(self.id);
      setLoading(false);
      return;
    }

    // Privileged → load all staff
    try {
      const res = await fetch("/api/staff");
      const json = await res.json();

      const list: Staff[] = json.staff || [];
      setStaffList(list);

      // Auto-select first staff if none selected yet
      if (!selectedStaffId && list.length > 0) {
        onSelect(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load staff:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, [session]);

  return (
    <div className="mb-6 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow">
      <label className="block mb-2 text-slate-300 font-medium">
        Select Staff Member
      </label>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <select
          className="bg-slate-800 border border-slate-700 rounded p-3 w-full text-slate-100"
          value={selectedStaffId ?? ""}
          onChange={(e) => onSelect(Number(e.target.value))}
        >
          <option value="" disabled>
            Select staff...
          </option>

          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
