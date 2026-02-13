// app/timesheet/admin/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import StaffSelector from "./components/StaffSelector";
import SummaryCards, { SummaryData } from "./components/SummaryCards";
import AdminTimesheetTable, {
  TimesheetEntry,
} from "./components/AdminTimesheetTable";
import EditDrawer from "./components/EditDrawer";

export default function AdminTimesheetPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);

  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ─────────────────────────────────────────────
  // Load session
  // ─────────────────────────────────────────────
  const loadSession = async () => {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const json = await res.json();
    setSession(json?.staff || null);
  };

  // ─────────────────────────────────────────────
  // Load staff list
  // ─────────────────────────────────────────────
  const loadStaffList = async () => {
    const res = await fetch("/api/staff");
    const json = await res.json();
    setStaffList(json.staff || []);
  };

  // ─────────────────────────────────────────────
  // Load summary for selected staff
  // ─────────────────────────────────────────────
  const loadSummary = async () => {
    if (!selectedStaff) return;

    const res = await fetch(
      `/api/timesheet/summary?staff_id=${selectedStaff.id}`
    );
    const json = await res.json();
    setSummary(json);
  };

  // ─────────────────────────────────────────────
  // Load timesheet entries for selected staff
  // ─────────────────────────────────────────────
  const loadEntries = async () => {
    if (!selectedStaff) return;

    const res = await fetch(
      `/api/timesheet/list?staff_id=${selectedStaff.id}`
    );
    const json = await res.json();
    setEntries(json.entries || []);
  };

  // ─────────────────────────────────────────────
  // Initial load
  // ─────────────────────────────────────────────
  useEffect(() => {
    loadSession();
    loadStaffList();
  }, []);

  useEffect(() => {
    if (session) setLoading(false);
  }, [session]);

  // ─────────────────────────────────────────────
  // Reload timesheet data when staff changes
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedStaff) return;
    loadSummary();
    loadEntries();
  }, [selectedStaff]);

  // ─────────────────────────────────────────────
  // Row click → open drawer
  // ─────────────────────────────────────────────
  const openEditDrawer = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setDrawerOpen(true);
  };

  // ─────────────────────────────────────────────
  // After Save / Delete → reload
  // ─────────────────────────────────────────────
  const handleSaved = () => {
    loadSummary();
    loadEntries();
  };

  const handleDeleted = () => {
    loadSummary();
    loadEntries();
  };

  if (loading) {
    return (
      <div className="text-slate-50 p-10">
        Loading admin timesheet tools...
      </div>
    );
  }

  const role = (session?.role || "").toLowerCase().trim();
  const isPrivileged = role === "admin" || role === "owner" || role === "manager";

  // Block unauthorized users
  if (!session || !isPrivileged) {
    return (
      <div className="text-red-400 text-xl p-10">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8 pb-20">
      <h1 className="text-3xl font-bold mb-6">Timesheet Administration</h1>

      {/* Staff selector */}
      <StaffSelector
        staff={staffList}
        selectedStaff={selectedStaff}
        onSelect={setSelectedStaff}
      />

      {!selectedStaff && (
        <div className="mt-10 text-slate-400 italic">
          Select a staff member to begin.
        </div>
      )}

      {selectedStaff && (
        <>
          {/* Summary Cards */}
          <SummaryCards summary={summary} staffName={selectedStaff.name} />

          {/* Table */}
          <AdminTimesheetTable entries={entries} onSelectEntry={openEditDrawer} />

          {/* Edit Drawer */}
          <EditDrawer
            entry={editingEntry}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        </>
      )}
    </div>
  );
}
