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
      {/* LEFT SIDE – ITEMS GRID */}
      <div className="flex-1 pt-24 p-6 overflow-y-auto">
        <POSItems
          items={pos.items}
          searchTerm={pos.searchTerm}
          setSearchTerm={pos.setSearchTerm}
          selectedCategory={pos.selectedCategory}
          setSelectedCategory={pos.setSelectedCategory}
          addToCart={pos.addToCart}
        />
      </div>

      {/* RIGHT SIDE – CART + CUSTOMER + CHECKOUT */}
      <div className="w-[380px] bg-slate-900 shadow-xl border-l border-slate-700 p-5 flex flex-col">

        {/* OPEN CUSTOMER MODAL BUTTON */}
        <button
          onClick={() => pos.setShowCustomerModal(true)}
          className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-medium hover:bg-slate-700 transition"
        >
          {pos.selectedCustomer ? "Change Customer" : "Add / Select Customer"}
        </button>

        {/* CUSTOMER STATUS */}
        <POSCustomerStatus
          customer={pos.selectedCustomer}
          discount={pos.discount}
          isBlacklisted={pos.isBlacklisted}
        />

        {/* CART */}
        <POSCart
          cart={pos.cart}
          updateQty={pos.updateQty}
          removeItem={pos.removeItem}
          originalTotal={pos.originalTotal}
          discount={pos.discount}
          discountAmount={pos.discountAmount}
          finalTotal={pos.finalTotal}
        />

        {/* CHECKOUT BUTTON */}
        <button
          onClick={() => pos.setIsCheckoutOpen(true)}
          disabled={pos.cart.length === 0}
          className="mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white py-3 rounded-lg shadow-lg font-semibold"
        >
          Checkout
        </button>
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
          customer={pos.selectedCustomer}
          onClose={() => pos.setShowEditCustomerModal(false)}
          onSaved={pos.refreshCustomer}
        />
      )}

      {/* CHECKOUT MODAL */}
      {pos.isCheckoutOpen && (
        <POSCheckoutModal
          finalTotal={pos.finalTotal}
          paymentMethod={pos.paymentMethod}
          setPaymentMethod={pos.setPaymentMethod}
          tabs={pos.tabs}
          onConfirm={pos.completeSale}
          onClose={() => pos.setIsCheckoutOpen(false)}
        />
      )}
    </div>
  );
}
