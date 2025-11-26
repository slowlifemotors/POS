// lib/staff.ts

/**
 * ===================================================================
 *  STAFF CLIENT — Frontend utilities for Staff CRUD operations
 * ===================================================================
 * This module provides simple wrappers for calling the backend APIs
 * while ensuring everything uses the canonical StaffRecord type.
 *
 * All functions return EXACTLY the flattened StaffRecord shape:
 *
 *   {
 *     id, name, username,
 *     role_id, role,
 *     permissions_level,
 *     commission_rate
 *   }
 *
 * No nested roles object, no role_name, no permissions mismatch.
 * ===================================================================
 */

import type { StaffRecord, ApiResponse } from "./types";

/* -------------------------------------------------------------
 * listStaff — GET /api/staff
 * ------------------------------------------------------------- */
export async function listStaff(): Promise<StaffRecord[]> {
  const res = await fetch("/api/staff", { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    console.error("listStaff error:", json);
    return [];
  }

  return (json.staff ?? []) as StaffRecord[];
}

/* -------------------------------------------------------------
 * createStaff — POST /api/staff
 * payload = { name, username, role_id, password }
 * ------------------------------------------------------------- */
export async function createStaff(payload: {
  name: string;
  username: string;
  role_id: number;
  password: string;
}): Promise<StaffRecord | null> {
  const res = await fetch("/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("createStaff error:", json);
    throw new Error(json.error || "Failed to create staff");
  }

  return json.staff as StaffRecord;
}

/* -------------------------------------------------------------
 * updateStaff — PUT /api/staff
 * payload = { id, name?, username?, role_id?, password? }
 * ------------------------------------------------------------- */
export async function updateStaff(
  id: number,
  updates: Partial<{
    name: string;
    username: string;
    role_id: number;
    password: string;
  }>
): Promise<StaffRecord | null> {
  const res = await fetch("/api/staff", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("updateStaff error:", json);
    throw new Error(json.error || "Failed to update staff");
  }

  return json.staff as StaffRecord;
}

/* -------------------------------------------------------------
 * deleteStaff — DELETE /api/staff?id=#
 * ------------------------------------------------------------- */
export async function deleteStaff(id: number): Promise<boolean> {
  const res = await fetch(`/api/staff?id=${id}`, {
    method: "DELETE",
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("deleteStaff error:", json);
    throw new Error(json.error || "Failed to delete staff");
  }

  return true;
}

/* -------------------------------------------------------------
 * getStaff (optional) — get single staff by ID if needed
 * ------------------------------------------------------------- */
export async function getStaff(id: number): Promise<StaffRecord | null> {
  const list = await listStaff();
  return list.find((s) => s.id === id) ?? null;
}
