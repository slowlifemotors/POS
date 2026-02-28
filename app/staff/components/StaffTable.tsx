// app/staff/components/StaffTable.tsx
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

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function StaffTable({ staff, onEdit, onRefresh }: StaffTableProps) {
  const [currentUser, setCurrentUser] = useState<StaffRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setCurrentUser(s.staff ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  function canEdit(target: StaffRecord): boolean {
    if (!currentUser) return false;
    if (currentUser.id === target.id) return true;

    const role = currentUser.role;

    if (role === "admin") return true;
    if (role === "owner") return target.role !== "admin" && target.role !== "owner";
    if (role === "manager")
      return target.role !== "admin" && target.role !== "owner" && target.role !== "manager";

    return false;
  }

  function canDelete(target: StaffRecord): boolean {
    if (!currentUser) return false;

    // nobody can delete themselves
    if (currentUser.id === target.id) return false;

    // admin can delete anyone except themselves (handled above)
    if (currentUser.role === "admin") return true;

    // owner can delete everyone except themselves and admins
    if (currentUser.role === "owner") return target.role !== "admin";

    // everyone else cannot delete
    return false;
  }

  async function handleDelete(target: StaffRecord) {
    if (!canDelete(target)) return;

    const label = `${target.name}${target.username ? ` (${target.username})` : ""}`;
    const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(target.id);

    try {
      const res = await fetch(`/api/staff?id=${encodeURIComponent(String(target.id))}`, {
        method: "DELETE",
      });

      const json = await safeJson(res);

      if (!res.ok) {
        alert(json?.error ?? "Failed to delete staff.");
        return;
      }

      await onRefresh();
    } catch (err) {
      console.error("Delete staff error:", err);
      alert("Failed to delete staff.");
    } finally {
      setDeletingId(null);
    }
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
        {sortedStaff.map((member) => {
          const deleteAllowed = canDelete(member);
          const isDeleting = deletingId === member.id;

          return (
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

                <button
                  disabled={!deleteAllowed || isDeleting}
                  onClick={() => handleDelete(member)}
                  className={`text-red-400 hover:text-red-300 ${
                    (!deleteAllowed || isDeleting) && "opacity-40 cursor-not-allowed"
                  }`}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}