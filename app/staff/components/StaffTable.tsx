//app/staff/components/StaffTable.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { StaffRecord } from "@/lib/types";

interface StaffTableProps {
  staff: StaffRecord[];
  onEdit: (member: StaffRecord) => void;
  onRefresh: () => Promise<void>;
}

const ROLE_ORDER = [
  "admin",
  "owner",
  "manager",
  "senior mechanic",
  "mechanic",
  "junior mechanic",
  "apprentice mechanic",
  "spethal merkernek",
  "bbrp gov",
];

export default function StaffTable({
  staff,
  onEdit,
  onRefresh,
}: StaffTableProps) {
  const [currentUser, setCurrentUser] = useState<StaffRecord | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => setCurrentUser(s.staff ?? null));
  }, []);

  function canEdit(target: StaffRecord): boolean {
    if (!currentUser) return false;
    if (currentUser.id === target.id) return true;

    const role = currentUser.role;

    if (role === "admin") return true;
    if (role === "owner")
      return target.role !== "admin" && target.role !== "owner";
    if (role === "manager")
      return (
        target.role !== "admin" &&
        target.role !== "owner" &&
        target.role !== "manager"
      );

    return false;
  }

  function canDelete(target: StaffRecord): boolean {
    if (!currentUser) return false;
    if (currentUser.id === target.id) return false;
    return currentUser.role === "admin" || currentUser.role === "owner";
  }

  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role);
      const rb = ROLE_ORDER.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [staff]);

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-800 border-b border-slate-700">
        <tr>
          <th className="p-3 text-left">Name</th>
          <th className="p-3 text-left">Username</th>
          <th className="p-3 text-left">Role</th>
          <th className="p-3 text-right">Actions</th>
        </tr>
      </thead>

      <tbody>
        {sortedStaff.map((member) => (
          <tr
            key={member.id}
            className="border-b border-slate-800 hover:bg-slate-800"
          >
            <td className="p-3">{member.name}</td>
            <td className="p-3">{member.username}</td>
            <td className="p-3 capitalize">{member.role}</td>
            <td className="p-3 text-right space-x-4">
              <button
                disabled={!canEdit(member)}
                onClick={() => canEdit(member) && onEdit(member)}
                className={`text-amber-400 hover:text-amber-300 ${
                  !canEdit(member) && "opacity-40 cursor-not-allowed"
                }`}
              >
                Edit
              </button>

              {canDelete(member) && (
                <button className="text-red-400 hover:text-red-300">
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
