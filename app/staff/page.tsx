// app/staff/page.tsx
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
  const [loading, setLoading] = useState(true);

  // ------------------------------------------------------------
  // ROLE GUARD — FORCE SAME ORIGIN + SEND COOKIES
  // ------------------------------------------------------------
  useEffect(() => {
    async function guard() {
      try {
        const res = await fetch(`${window.location.origin}/api/auth/session`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const session = await res.json();

        if (!session.staff) {
          router.push("/login");
          return;
        }

        const level = Number(session.staff.permissions_level ?? 0);

        if (level < 800) {
          router.push("/pos");
          return;
        }
      } catch {
        router.push("/login");
      }
    }

    guard();
  }, [router]);

  // ------------------------------------------------------------
  // LOAD STAFF LIST — FORCE SAME ORIGIN + COOKIES
  // ------------------------------------------------------------
  async function loadStaff() {
    try {
      setLoading(true);

      const res = await fetch(`${window.location.origin}/api/staff`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        router.push("/login");
        return;
      }

      const json = await res.json();
      setStaff(json.staff ?? []);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <div className="p-6 text-slate-100 pt-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-fuchsia-500">
          Staff Management
        </h1>

        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 px-4 py-2 rounded-lg text-white"
        >
          + Add Staff
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading staff...</p>
      ) : (
        <StaffTable
          staff={staff}
          onEdit={(member) => {
            setEditing(member);
            setShowModal(true);
          }}
          onRefresh={loadStaff}
        />
      )}

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
