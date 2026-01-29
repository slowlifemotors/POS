//app/staff/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StaffTable from "./components/StaffTable";
import EditStaffModal from "./components/EditStaffModal";
import type { StaffRecord } from "@/lib/types";

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [editing, setEditing] = useState<StaffRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!s.staff) router.push("/login");
        setSession(s.staff);
      });
  }, [router]);

  async function loadStaff() {
    const res = await fetch("/api/staff");
    const json = await res.json();
    setStaff(json.staff ?? []);
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const canAdd =
    session &&
    ["admin", "owner", "manager"].includes(session.role);

  return (
    <div className="min-h-screen pt-24 px-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Staff</h2>

        {canAdd && (
          <button
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            className="bg-[color:var(--accent)] px-4 py-2 rounded-lg"
          >
            + Add Staff
          </button>
        )}
      </div>

      <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
        <StaffTable
          staff={staff}
          onEdit={(m) => {
            setEditing(m);
            setShowModal(true);
          }}
          onRefresh={loadStaff}
        />
      </div>

      {showModal && (
        <EditStaffModal
          staffMember={editing}
          onClose={() => setShowModal(false)}
          onSaved={loadStaff}
        />
      )}
    </div>
  );
}
