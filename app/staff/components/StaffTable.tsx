// app/staff/components/StaffTable.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { StaffRecord } from "@/lib/types";

interface StaffTableProps {
  staff: StaffRecord[];
  onEdit: (member: StaffRecord) => void;
  onRefresh: () => Promise<void>;
}

export default function StaffTable({
  staff,
  onEdit,
  onRefresh,
}: StaffTableProps) {
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    role: string;
    permissions: number;
  } | null>(null);

  // -------------------------------------------------
  // Load current session
  // -------------------------------------------------
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const json = await res.json();
        if (!json.staff) return;

        setCurrentUser({
          id: json.staff.id,
          role: json.staff.role.toLowerCase(),
          permissions: json.staff.permissions_level ?? 0,
        });
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }

    loadSession();
  }, []);

  // -------------------------------------------------
  // PERMISSION LOGIC
  // -------------------------------------------------
  function canModify(member: StaffRecord): boolean {
    if (!currentUser) return false;

    const callerId = currentUser.id;
    const callerRole = currentUser.role;
    const targetRole = member.role.toLowerCase();
    const targetId = member.id;

    // 1. Everyone can edit themselves
    if (callerId === targetId) return true;

    // 2. Admin can edit anyone
    if (callerRole === "admin") return true;

    // 3. Owner can edit anyone except admin
    if (callerRole === "owner") {
      if (targetRole === "admin") return false;
      return true;
    }

    // 4. Everyone else cannot edit others
    return false;
  }

  function canDelete(member: StaffRecord): boolean {
    if (!currentUser) return false;

    const callerId = currentUser.id;
    const callerRole = currentUser.role;
    const targetRole = member.role.toLowerCase();
    const targetId = member.id;

    // 1. No one can delete themselves
    if (callerId === targetId) return false;

    // 2. Admin can delete anyone except self
    if (callerRole === "admin") return true;

    // 3. Owner can delete anyone except admin
    if (callerRole === "owner") {
      if (targetRole === "admin") return false;
      return true;
    }

    // 4. Everyone else cannot delete anyone
    return false;
  }

  // -------------------------------------------------
  // SORT STAFF BY ROLE PRIORITY THEN ALPHABETICALLY
  // -------------------------------------------------
  const sortedStaff = useMemo(() => {
    if (!staff) return [];

    return [...staff].sort((a, b) => {
      // Sort by permissions_level DESC (higher first)
      if (a.permissions_level !== b.permissions_level) {
        return b.permissions_level - a.permissions_level;
      }

      // Then alphabetically by name ASC
      return a.name.localeCompare(b.name);
    });
  }, [staff]);

  // -------------------------------------------------
  // DELETE HANDLER
  // -------------------------------------------------
  async function handleDelete(member: StaffRecord) {
    if (!confirm(`Delete ${member.name}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/staff?id=${member.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "Failed to delete staff.");
        return;
      }

      await onRefresh();
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Delete error. Check console.");
    }
  }

  // -------------------------------------------------
  // UI
  // -------------------------------------------------
  return (
    <div className="bg-slate-900 p-4 rounded-xl shadow-lg">
      <table className="w-full text-left">
        <thead>
          <tr className="text-fuchsia-400 border-b border-slate-700">
            <th className="py-2 px-2">Name</th>
            <th className="py-2 px-2">Username</th>
            <th className="py-2 px-2">Role</th>
            <th className="py-2 px-2 text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedStaff.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-slate-500 text-center">
                No staff found.
              </td>
            </tr>
          ) : (
            sortedStaff.map((member) => {
              const editable = canModify(member);
              const deletable = canDelete(member);

              return (
                <tr key={member.id} className="border-b border-slate-800">
                  <td className="py-2 px-2">{member.name}</td>
                  <td className="py-2 px-2">{member.username}</td>
                  <td className="py-2 px-2 capitalize">{member.role}</td>

                  {/* ACTIONS */}
                  <td className="py-2 px-2 text-right space-x-4">

                    {/* EDIT BUTTON — Yellow */}
                    <button
                      disabled={!editable}
                      onClick={() => editable && onEdit(member)}
                      className={`text-yellow-400 hover:underline ${
                        !editable ? "opacity-30 cursor-not-allowed" : ""
                      }`}
                    >
                      Edit
                    </button>

                    {/* DELETE BUTTON — Red */}
                    {deletable && (
                      <button
                        onClick={() => handleDelete(member)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="mt-4 text-right">
        <button
          onClick={onRefresh}
          className="text-slate-400 hover:text-white text-sm underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
