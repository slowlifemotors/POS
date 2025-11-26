// app/api/staff/route.ts
/**
 * STAFF MANAGEMENT API
 * Handles CRUD, permission logic, and password hashing.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import type { StaffRecord } from "@/lib/types";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------
// SUPABASE SERVER CLIENT
// ---------------------------------------------------------
function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ---------------------------------------------------------
// NORMALIZE STAFF ROW
// ---------------------------------------------------------
function normalizeStaffRow(row: any): StaffRecord {
  const roleName = row.roles?.name?.toLowerCase() || "staff";

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role_id: row.role_id,
    role: roleName,
    permissions_level: Number(row.roles?.permissions_level ?? 0),
    commission_rate: Number(row.roles?.commission_rate ?? 0),
  };
}

// ---------------------------------------------------------
// GET CALLER INFO
// ---------------------------------------------------------
async function getCallerInfo(): Promise<StaffRecord | null> {
  const session = await getSession();
  if (!session?.staff?.id) return null;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .eq("id", session.staff.id)
    .single();

  if (error || !data) return null;

  return normalizeStaffRow(data);
}

// ---------------------------------------------------------
// MODIFY PERMISSION LOGIC
// ---------------------------------------------------------
function canModify(caller: StaffRecord, target: StaffRecord): string | null {
  if (caller.id === target.id) return null;

  if (caller.role === "admin") return null;

  if (caller.role === "owner") {
    if (target.role === "admin") return "Owners cannot modify admin accounts.";
    return null;
  }

  return "You may not modify other staff.";
}

// ---------------------------------------------------------
// ROLE ASSIGN RULES
// ---------------------------------------------------------
function canAssignRole(
  caller: StaffRecord,
  newRole: { name: string; permissions_level: number }
): string | null {
  const newName = newRole.name.toLowerCase();

  if (caller.role === "owner" && newName === "admin")
    return "Owners cannot assign admin role.";

  return null;
}

// ---------------------------------------------------------
// GET STAFF LIST
// ---------------------------------------------------------
export async function GET() {
  const caller = await getCallerInfo();
  if (!caller)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (caller.permissions_level < 800)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .order("id");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ staff: data.map(normalizeStaffRow) });
}

// ---------------------------------------------------------
// CREATE STAFF
// ---------------------------------------------------------
export async function POST(req: Request) {
  const caller = await getCallerInfo();
  if (!caller)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (caller.permissions_level < 800)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, username, role_id, password } = await req.json();

  if (!password)
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );

  const supabase = supabaseServer();

  const { data: role } = await supabase
    .from("roles")
    .select("*")
    .eq("id", role_id)
    .single();

  if (!role)
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const assignError = canAssignRole(caller, role);
  if (assignError)
    return NextResponse.json({ error: assignError }, { status: 403 });

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("staff")
    .insert({
      name,
      username,
      role_id,
      password_hash,
      active: true,
    })
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ staff: normalizeStaffRow(data) });
}

// ---------------------------------------------------------
// UPDATE STAFF
// ---------------------------------------------------------
export async function PUT(req: Request) {
  const caller = await getCallerInfo();
  if (!caller)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id, ...updates } = await req.json();

  if (!id)
    return NextResponse.json({ error: "Missing staff ID" }, { status: 400 });

  const supabase = supabaseServer();

  const { data: targetRaw } = await supabase
    .from("staff")
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .eq("id", id)
    .single();

  if (!targetRaw)
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const target = normalizeStaffRow(targetRaw);

  const modifyError = canModify(caller, target);
  if (modifyError)
    return NextResponse.json({ error: modifyError }, { status: 403 });

  // SELF ROLE PROTECT
  if (
    updates.role_id !== undefined &&
    caller.id === id &&
    caller.role !== "admin" &&
    caller.role !== "owner"
  ) {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 403 }
    );
  }

  if (updates.role_id !== undefined) {
    const { data: newRole } = await supabase
      .from("roles")
      .select("*")
      .eq("id", updates.role_id)
      .single();

    if (!newRole)
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const assignError = canAssignRole(caller, newRole);
    if (assignError)
      return NextResponse.json({ error: assignError }, { status: 403 });
  }

  // PASSWORD UPDATE
  if (updates.password) {
    updates.password_hash = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }

  const { data, error } = await supabase
    .from("staff")
    .update(updates)
    .eq("id", id)
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ staff: normalizeStaffRow(data) });
}

// ---------------------------------------------------------
// DELETE STAFF (FINAL RULES)
// ---------------------------------------------------------
export async function DELETE(req: Request) {
  const caller = await getCallerInfo();
  if (!caller)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id)
    return NextResponse.json({ error: "Missing staff ID" }, { status: 400 });

  const supabase = supabaseServer();

  const { data: targetRaw } = await supabase
    .from("staff")
    .select(
      `
      id,
      name,
      username,
      role_id,
      roles:role_id (
        name,
        permissions_level,
        commission_rate
      )
    `
    )
    .eq("id", id)
    .single();

  if (!targetRaw)
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const target = normalizeStaffRow(targetRaw);

  // ------------------------------
  // FINAL DELETE RULES
  // ------------------------------

  // ❌ Nobody can delete admin
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted." },
      { status: 403 }
    );
  }

  // Admin and Owner can delete owner + everyone else
  if (caller.role === "admin" || caller.role === "owner") {
    // Prevent self-delete for safety
    if (caller.id === target.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 403 }
      );
    }
  } else {
    // Everyone else cannot delete anyone
    return NextResponse.json(
      { error: "You are not allowed to delete staff." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Staff deleted" });
}
