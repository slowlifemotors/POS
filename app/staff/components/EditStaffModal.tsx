// app/staff/components/EditStaffModal.tsx
"use client";

import { useState, useEffect } from "react";
import type { StaffRecord, RoleRecord } from "@/lib/types";
import { createStaff, updateStaff } from "@/lib/staff";

interface EditStaffModalProps {
  staffMember: StaffRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditStaffModal({
  staffMember,
  onClose,
  onSaved,
}: EditStaffModalProps) {
  const isEdit = !!staffMember;

  // -----------------------------------------------------
  // LOCAL STATE
  // -----------------------------------------------------
  const [name, setName] = useState(staffMember?.name ?? "");
  const [username, setUsername] = useState(staffMember?.username ?? "");
  const [roleId, setRoleId] = useState<number>(staffMember?.role_id ?? 0);

  // IMPORTANT: password must persist and never get “reset” by render
  const [password, setPassword] = useState("");

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // SESSION CALLER
  const [callerRole, setCallerRole] = useState<string>("staff");
  const [callerLevel, setCallerLevel] = useState<number>(0);

  // TARGET STAFF
  const targetRole = staffMember?.role ?? "staff";

  // -----------------------------------------------------
  // LOAD SESSION
  // -----------------------------------------------------
  useEffect(() => {
    async function loadSession() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await res.json();

      if (json?.staff) {
        setCallerRole(json.staff.role.toLowerCase());
        setCallerLevel(json.staff.permissions_level);
      }
    }
    loadSession();
  }, []);

  // -----------------------------------------------------
  // LOAD ROLES + PRESELECT
  // -----------------------------------------------------
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await fetch("/api/roles", { cache: "no-store" });
        const json = await res.json();

        if (res.ok && json.roles) {
          const list: RoleRecord[] = json.roles;
          setRoles(list);

          if (isEdit && staffMember) {
            setRoleId(staffMember.role_id);
          } else if (!isEdit && list.length > 0) {
            setRoleId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Role load error:", err);
      } finally {
        setRolesLoading(false);
      }
    }

    loadRoles();
  }, [isEdit, staffMember]);

  // -----------------------------------------------------
  // ROLE DROPDOWN PERMISSIONS
  // -----------------------------------------------------
  const roleDropdownDisabled = (() => {
    if (!isEdit) {
      // NEW STAFF
      return !(callerRole === "admin" || callerRole === "owner");
    }

    // EDIT STAFF
    if (callerRole === "admin") return false;

    if (callerRole === "owner") {
      if (targetRole === "admin") return true;
      return false;
    }

    // everyone else cannot change roles
    return true;
  })();

  // Which roles caller can assign
  const allowedRoles = roles.filter((role) => {
    const r = role.name.toLowerCase();

    if (callerRole === "admin") return true;
    if (callerRole === "owner") return r !== "admin";

    return false;
  });

  // -----------------------------------------------------
  // SAVE
  // -----------------------------------------------------
  async function handleSave() {
    if (!name.trim() || !username.trim()) {
      alert("Name and username are required.");
      return;
    }

    if (!isEdit && !password.trim()) {
      alert("Password is required for new staff.");
      return;
    }

    setLoading(true);

    try {
      if (isEdit && staffMember) {
        const payload: any = { name, username };

        if (!roleDropdownDisabled) {
          payload.role_id = roleId;
        }

        if (password.trim()) {
          payload.password = password; // API hashes it
        }

        await updateStaff(staffMember.id, payload);
      } else {
        await createStaff({
          name,
          username,
          role_id: roleId,
          password,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Staff save error:", err);
      alert("Failed to save staff.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 text-slate-100 shadow-xl">
        <h2 className="text-2xl font-bold text-fuchsia-500 mb-4">
          {isEdit ? "Edit Staff" : "Add Staff"}
        </h2>

        <div className="space-y-3">

          <label className="text-sm text-slate-300">Full Name</label>
          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="text-sm text-slate-300">Username</label>
          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="text-sm text-slate-300">Role</label>
          {rolesLoading ? (
            <div className="text-slate-400">Loading roles...</div>
          ) : (
            <select
              disabled={roleDropdownDisabled}
              className={`w-full bg-slate-800 border border-slate-700 p-2 rounded ${
                roleDropdownDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {allowedRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.commission_rate}%)
                </option>
              ))}
            </select>
          )}

          <label className="text-sm text-slate-300">
            {isEdit ? "New Password (optional)" : "Password"}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
              placeholder={
                isEdit ? "New password (optional)" : "Password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-2 text-xs text-fuchsia-400 hover:text-fuchsia-300"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={loading || rolesLoading}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 rounded text-white disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
