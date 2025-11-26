// app/payments/page.tsx
"use client";

import React, { useEffect, useState } from "react";

import StaffSelector from "./components/StaffSelector";
import PaymentSummaryCard from "./components/PaymentSummaryCard";
import PaymentHistoryTable from "./components/PaymentHistoryTable";
import ConfirmPaymentModal from "./components/ConfirmPaymentModal";
import PaymentHeaderStats from "./components/PaymentHeaderStats";

type Staff = {
  id: number;
  name: string;
  role: string;
};

type PaymentSummary = {
  staff_id: number;
  period: {
    start: string;
    end: string;
  };
  hours: {
    total: number;
    hourly_rate: number;
    hourly_pay: number;
  };
  commission: {
    rate: number;
    profit: number;
    value: number;
  };
  total_pay: number;
};

type PaymentHistoryRecord = {
  id: number;
  staff_id: number;
  staff_name: string;
  period_start: string;
  period_end: string;
  hours_worked: number;
  hourly_pay: number;
  commission: number;
  total_paid: number;
  paid_by: number;
  paid_by_name: string;
  created_at: string;
};

export default function PaymentsPage() {
  const [session, setSession] = useState<any>(null);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [history, setHistory] = useState<PaymentHistoryRecord[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // -------------------------------------------------------
  // SESSION
  // -------------------------------------------------------
  const loadSession = async () => {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const json = await res.json();
    setSession(json?.staff || null);
  };

  // -------------------------------------------------------
  // STAFF LIST
  // -------------------------------------------------------
  const loadStaffList = async () => {
    if (!session) return;

    const role = session.role.toLowerCase();
    const isPrivileged = ["admin", "owner", "manager"].includes(role);

    // NORMAL STAFF — can only pay themselves
    if (!isPrivileged) {
      setStaffList([{ id: session.id, name: session.name, role: session.role }]);
      setSelectedStaffId(session.id);
      return;
    }

    // ADMINS / OWNER / MANAGER — full list
    const res = await fetch("/api/staff");
    const json = await res.json();
    setStaffList(json.staff || []);
  };

  // -------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------
  const loadSummary = async () => {
    if (!selectedStaffId) return;

    setLoadingSummary(true);

    const res = await fetch(`/api/payments/calculate?staff_id=${selectedStaffId}`);
    const json = await res.json();

    const valid =
      json &&
      json.period &&
      json.hours &&
      json.commission &&
      typeof json.total_pay === "number";

    setSummary(valid ? json : null);
    setLoadingSummary(false);
  };

  // -------------------------------------------------------
  // HISTORY
  // -------------------------------------------------------
  const loadHistory = async () => {
    if (!selectedStaffId) return;

    setLoadingHistory(true);

    const res = await fetch(`/api/payments/history?staff_id=${selectedStaffId}`);
    const json = await res.json();

    setHistory(json.history || []);
    setLoadingHistory(false);
  };

  // -------------------------------------------------------
  // CONFIRM PAY
  // -------------------------------------------------------
  const confirmPayment = async () => {
    if (!summary) return;

    const body = {
      staff_id: summary.staff_id,
      period_start: summary.period.start,
      period_end: summary.period.end,

      // HOURS
      hours: summary.hours.total,
      hourly_rate: summary.hours.hourly_rate,
      hourly_pay: summary.hours.hourly_pay,

      // COMMISSION
      commission_rate: summary.commission.rate,
      commission_profit: summary.commission.profit,
      commission_value: summary.commission.value,

      // TOTAL
      total_pay: summary.total_pay,
    };

    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setConfirmOpen(false);
      await loadSummary();
      await loadHistory();
      alert("Payment recorded!");
    } else {
      alert("Payment failed.");
    }
  };

  // -------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------
  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (session) loadStaffList();
  }, [session]);

  useEffect(() => {
    if (selectedStaffId !== null) {
      loadSummary();
      loadHistory();
    }
  }, [selectedStaffId]);

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  if (!session) {
    return <div className="p-10 text-slate-200">Loading session...</div>;
  }

  const isPrivileged = ["admin", "owner", "manager"].includes(
    session.role.toLowerCase()
  );

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8">
      <h1 className="text-3xl font-bold mb-6">Payments</h1>

      <PaymentHeaderStats session={session} />

      {/* STAFF SELECTOR */}
      <StaffSelector
        session={session}
        selectedStaffId={selectedStaffId}
        onSelect={setSelectedStaffId}
      />

      {/* SUMMARY SECTION */}
      {loadingSummary ? (
        <div className="p-6 text-slate-400">Loading summary...</div>
      ) : summary ? (
        <div className="mb-10">
          <PaymentSummaryCard summary={summary} />

          {isPrivileged && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="mt-6 bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3 rounded-lg font-semibold"
            >
              Confirm Payment
            </button>
          )}
        </div>
      ) : (
        <div className="text-slate-500 italic mb-10">
          No summary available.
        </div>
      )}

      {/* HISTORY */}
      <h2 className="text-2xl font-bold mb-4">Payment History</h2>

      <PaymentHistoryTable records={history} loading={loadingHistory} />

      {/* CONFIRM MODAL */}
      {confirmOpen && summary && (
        <ConfirmPaymentModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          summary={summary}
          staffName={selectedStaff?.name || ""}
          onPaid={async () => {
            await loadSummary();
            await loadHistory();
          }}
        />
      )}
    </div>
  );
}
