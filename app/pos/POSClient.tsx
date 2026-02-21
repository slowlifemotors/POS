// app/pos/POSClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import POSItems from "./components/POSItems";
import POSCart from "./components/POSCart";
import POSCheckoutModal from "./components/POSCheckoutModal";
import POSCustomerStatus from "./components/POSCustomerStatus";
import AddCustomerModal from "./components/AddCustomerModal";
import EditCustomerModal from "./components/EditCustomerModal";
import POSAdBanner from "./components/POSAdBanner";

import usePOS from "./hooks/usePOS";

function fmtDT(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isAllowedManualDiscount(p: number) {
  return p === 0 || p === 10; // 15/20 disabled for now
}

export default function POSClient({
  staffId,
  staffName,
}: {
  staffId: number;
  staffName: string;
}) {
  const pos = usePOS({ staffId, staffName });

  const voucherAllowed = pos.selectedCustomerType === "customer" && !!pos.selectedCustomer;
  const voucherBalance = voucherAllowed ? Number((pos.selectedCustomer as any)?.voucher_amount ?? 0) : 0;

  const [showSavedJobs, setShowSavedJobs] = useState(false);

  const [showDiscountPicker, setShowDiscountPicker] = useState(false);

  useEffect(() => {
    if (!showSavedJobs) return;
    pos.loadSavedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSavedJobs]);

  const canSave = (pos.cart ?? []).length > 0;

  const headerDraftText = useMemo(() => {
    if (!pos.currentDraftId) return null;
    return `Editing saved job`;
  }, [pos.currentDraftId]);

  const onSaveJob = async () => {
    const title = window.prompt("Saved Job Name (optional):", "");
    const id = await pos.saveJob(title ?? "");
    if (!id) return;

    alert("Job saved.");

    // start a fresh job after saving
    pos.startNewJob();
  };

  const applyManualDiscount = (pct: number) => {
    if (!isAllowedManualDiscount(pct)) return;
    pos.setManualDiscountPercent(pct);
    setShowDiscountPicker(false);
  };

  return (
    <div className="flex h-screen bg-transparent text-slate-50">
      <div className="flex-1 overflow-y-auto">
        <div className="pt-8 px-3 pb-3 space-y-3">
          <POSAdBanner />

          <POSItems
            vehicles={pos.filteredVehicles}
            selectedVehicle={pos.selectedVehicle}
            modsRoot={pos.modsRoot}
            searchTerm={pos.searchTerm}
            setSearchTerm={pos.setSearchTerm}
            onSelectVehicle={pos.selectVehicle}
            onClearVehicle={pos.clearVehicle}
            onAddMod={pos.addModToCart}
          />
        </div>
      </div>

      <div className="w-95 bg-slate-900 shadow-xl border-l border-slate-700 p-5 flex flex-col">
        {headerDraftText && (
          <div className="mb-3 rounded-lg border border-amber-700/40 bg-amber-900/15 px-3 py-2 text-amber-200 text-sm">
            {headerDraftText}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={onSaveJob}
            disabled={!canSave || pos.isPaying}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition disabled:bg-slate-800/40 disabled:text-slate-500 disabled:border-slate-800"
            type="button"
            title={!canSave ? "Add items to cart first" : "Save this job and return later"}
          >
            Save Job
          </button>

          <button
            onClick={() => setShowSavedJobs(true)}
            disabled={pos.isPaying}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition disabled:bg-slate-800/40 disabled:text-slate-500 disabled:border-slate-800"
            type="button"
          >
            Saved Jobs
          </button>
        </div>

        <button
          onClick={() => setShowDiscountPicker(true)}
          disabled={pos.isPaying}
          className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition disabled:bg-slate-800/40 disabled:text-slate-500 disabled:border-slate-800"
          type="button"
          title="Adds on top of existing discounts (raffle ticket sales excluded)"
        >
          Add Discount
          {pos.manualDiscountPercent > 0 ? (
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-700/40 border border-amber-600 text-amber-100">
              +{pos.manualDiscountPercent}%
            </span>
          ) : null}
        </button>

        <button
          onClick={() => pos.setShowCustomerModal(true)}
          className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition"
          type="button"
        >
          {pos.selectedCustomer ? "Change Customer" : "Add / Select Customer"}
        </button>

        {pos.selectedCustomer && pos.selectedCustomerType === "customer" && (
          <button
            onClick={() => pos.setShowEditCustomerModal(true)}
            className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition"
            type="button"
          >
            Edit Customer
          </button>
        )}

        <POSCustomerStatus
          customer={pos.selectedCustomer}
          discount={pos.discount}
          isBlacklisted={pos.isBlacklisted}
          customerType={pos.selectedCustomerType}
          manualDiscountPercent={pos.manualDiscountPercent}
        />

        <div className="mb-4 p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Plate</h3>
          <input
            value={pos.plate}
            onChange={(e) => pos.setPlate(e.target.value)}
            placeholder="e.g. ABC123"
            className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-2">Logged on the job after checkout.</p>
        </div>

        <POSCart
          cart={pos.cart ?? []}
          updateQty={pos.updateQty}
          removeItem={pos.removeItem}
          originalTotal={pos.originalTotal}
          discount={pos.discount}
          discountAmount={pos.discountAmount}
          staffDiscountAmount={pos.staffDiscountAmount}
          finalTotal={pos.finalTotal}
          isStaffSale={pos.selectedCustomerType === "staff"}
          showDiscountLine={pos.hasAnyDiscountLine}
          discountLineLabel={pos.discountLineLabel}
        />

        <button
          onClick={() => pos.setIsCheckoutOpen(true)}
          disabled={!pos.canCheckout || pos.isPaying}
          className="mt-4 bg-(--accent) hover:(--accent-hover) disabled:bg-slate-700 disabled:text-slate-400 text-white py-3 rounded-lg shadow-lg font-semibold"
          type="button"
        >
          {pos.isPaying ? "Processing..." : "Pay"}
        </button>

        {pos.isBlacklisted && pos.selectedCustomerType === "customer" && (
          <p className="mt-2 text-xs text-red-400 text-center font-semibold">
            Blacklisted customer — invoice is doubled (x2).
          </p>
        )}
      </div>

      {showDiscountPicker && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-slate-900 w-[520px] max-w-[95vw] p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Add Discount</h2>
              <button
                onClick={() => setShowDiscountPicker(false)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="text-sm text-slate-300 mb-4">
              This stacks on top of existing discounts (raffle ticket sales excluded).
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => applyManualDiscount(10)}
                className={`py-3 rounded border font-semibold ${
                  pos.manualDiscountPercent === 10
                    ? "bg-(--accent) border-(--accent) text-white"
                    : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                }`}
                disabled={pos.isPaying}
              >
                10%
              </button>

              <button
                type="button"
                className="py-3 rounded border font-semibold bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
                disabled
                title="Not enabled yet"
              >
                15%
              </button>

              <button
                type="button"
                className="py-3 rounded border font-semibold bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed"
                disabled
                title="Not enabled yet"
              >
                20%
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Current manual discount:{" "}
                <span className="font-semibold text-slate-200">
                  {pos.manualDiscountPercent ? `${pos.manualDiscountPercent}%` : "None"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => applyManualDiscount(0)}
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm font-semibold"
                disabled={pos.isPaying || pos.manualDiscountPercent === 0}
                title="Remove the manual discount"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {pos.showCustomerModal && (
        <AddCustomerModal
          onClose={() => pos.setShowCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {pos.showEditCustomerModal && (
        <EditCustomerModal
          customer={pos.selectedCustomerType === "customer" ? (pos.selectedCustomer as any) : null}
          onClose={() => pos.setShowEditCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {pos.isCheckoutOpen && (
        <POSCheckoutModal
          finalTotal={pos.finalTotal}
          voucherBalance={voucherBalance}
          voucherAllowed={voucherAllowed}
          onConfirm={(note, payment) => pos.createOrder(note, payment)}
          onClose={() => pos.setIsCheckoutOpen(false)}
          isPaying={pos.isPaying}
        />
      )}

      {showSavedJobs && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-slate-900 w-[720px] max-w-[95vw] p-6 rounded-xl border border-slate-700 shadow-xl text-slate-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Saved Jobs</h2>

              <button
                onClick={() => setShowSavedJobs(false)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                type="button"
              >
                Close
              </button>
            </div>

            {pos.draftsLoading ? (
              <div className="text-slate-400">Loading…</div>
            ) : pos.draftsError ? (
              <div className="mb-4 rounded border border-red-700/50 bg-red-900/20 p-3 text-red-200">
                {pos.draftsError}
              </div>
            ) : pos.drafts.length === 0 ? (
              <div className="text-slate-400">No saved jobs.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {pos.drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {d.title?.trim() ? d.title : "Untitled Job"}
                      </div>
                      <div className="text-xs text-slate-400">
                        Updated: {fmtDT(d.updated_at)} • Created: {fmtDT(d.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await pos.resumeJob(d.id);
                          setShowSavedJobs(false);
                        }}
                        className="px-3 py-2 rounded bg-(--accent) hover:bg-(--accent-hover) text-white text-sm font-semibold"
                      >
                        Resume
                      </button>

                      <button
                        type="button"
                        onClick={() => pos.deleteJob(d.id)}
                        className="px-3 py-2 rounded bg-slate-900 border border-slate-600 hover:bg-slate-700 text-slate-100 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => pos.loadSavedJobs()}
                className="px-3 py-2 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}