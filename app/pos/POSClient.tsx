// app/pos/POSClient.tsx
"use client";

import POSItems from "./components/POSItems";
import POSCart from "./components/POSCart";
import POSCheckoutModal from "./components/POSCheckoutModal";
import POSCustomerStatus from "./components/POSCustomerStatus";
import AddCustomerModal from "./components/AddCustomerModal";
import EditCustomerModal from "./components/EditCustomerModal";
import usePOS from "./hooks/usePOS";

export default function POSClient({
  staffId,
  staffName,
}: {
  staffId: number;
  staffName: string;
}) {
  const pos = usePOS({ staffId, staffName });

  return (
    <div className="flex h-screen bg-transparent text-slate-50">
      <div className="flex-1">
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

      <div className="w-95 bg-slate-900 shadow-xl border-l border-slate-700 p-5 flex flex-col">
        <button
          onClick={() => pos.setShowCustomerModal(true)}
          className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition"
        >
          {pos.selectedCustomer ? "Change Customer" : "Add / Select Customer"}
        </button>

        <POSCustomerStatus
          customer={pos.selectedCustomer}
          discount={pos.discount}
          isBlacklisted={pos.isBlacklisted}
          customerType={pos.selectedCustomerType}
        />

        {/* ✅ Plate entry just under customer */}
        <div className="mb-4 p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Plate</h3>
          <input
            value={pos.plate}
            onChange={(e) => pos.setPlate(e.target.value)}
            placeholder="e.g. ABC123"
            className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-2">
            Logged on the job after checkout.
          </p>
        </div>

        <POSCart
          cart={pos.cart}
          updateQty={pos.updateQty}
          removeItem={pos.removeItem}
          originalTotal={pos.originalTotal}
          discount={pos.discount}
          discountAmount={pos.discountAmount}
          staffDiscountAmount={pos.staffDiscountAmount}
          finalTotal={pos.finalTotal}
          isStaffSale={pos.selectedCustomerType === "staff"}
        />

        <button
          onClick={() => pos.setIsCheckoutOpen(true)}
          disabled={!pos.canCheckout || pos.isPaying}
          className="mt-4 bg-(--accent) hover:(--accent-hover) disabled:bg-slate-700 disabled:text-slate-400 text-white py-3 rounded-lg shadow-lg font-semibold"
        >
          {pos.isPaying ? "Processing..." : "Pay (Card)"}
        </button>

        {pos.isBlacklisted && (
          <p className="mt-2 text-xs text-red-400 text-center font-semibold">
            This customer is currently blacklisted — checkout is blocked.
          </p>
        )}
      </div>

      {pos.showCustomerModal && (
        <AddCustomerModal
          onClose={() => pos.setShowCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {pos.showEditCustomerModal && (
        <EditCustomerModal
          onClose={() => pos.setShowEditCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {pos.isCheckoutOpen && (
        <POSCheckoutModal
          finalTotal={pos.finalTotal}
          onConfirm={(note) => pos.createOrder(note)}
          onClose={() => pos.setIsCheckoutOpen(false)}
          isPaying={pos.isPaying}
        />
      )}
    </div>
  );
}
