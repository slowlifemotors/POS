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
      {/* LEFT SIDE – VEHICLES (left column) + MODS (right column) */}
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

      {/* RIGHT SIDE – CART + CUSTOMER + CHECKOUT */}
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

        {!pos.canCheckout && pos.cart.length > 0 && !pos.selectedVehicle && (
          <p className="mt-2 text-xs text-slate-400 text-center">
            Select a vehicle to checkout vehicle mods (service items can checkout without a vehicle).
          </p>
        )}

        {pos.isBlacklisted && (
          <p className="mt-2 text-xs text-red-400 text-center font-semibold">
            This customer is currently blacklisted — checkout is blocked.
          </p>
        )}
      </div>

      {/* ADD CUSTOMER MODAL */}
      {pos.showCustomerModal && (
        <AddCustomerModal
          onClose={() => pos.setShowCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {/* EDIT CUSTOMER MODAL */}
      {pos.showEditCustomerModal && (
        <EditCustomerModal
          onClose={() => pos.setShowEditCustomerModal(false)}
          onSelectCustomer={pos.handleSelectCustomer}
        />
      )}

      {/* CHECKOUT MODAL */}
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
