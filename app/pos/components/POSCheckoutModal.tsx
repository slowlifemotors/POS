// app/pos/components/POSCheckoutModal.tsx
"use client";

export default function POSCheckoutModal({
  finalTotal,
  paymentMethod,
  setPaymentMethod,
  tabs,
  onConfirm,
  onClose,
}: {
  finalTotal: number;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  tabs: { id: number; name: string; amount: number; active: boolean }[];
  onConfirm: (payment: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl p-6 w-[380px] shadow-xl border border-slate-700 space-y-4">
        <h2 className="text-2xl font-bold mb-2">Complete Sale</h2>

        <p className="text-lg">
          Total:{" "}
          <span className="font-bold text-emerald-400">
            ${finalTotal.toFixed(2)}
          </span>
        </p>

        <div>
          <label className="block text-sm mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>

            {tabs
              .filter((t) => t.active)
              .map((t) => (
                <option key={t.id} value={`tab:${t.id}`}>
                  {t.name} — ${t.amount.toLocaleString()}
                </option>
              ))}
          </select>
        </div>

        <button
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold text-white"
          onClick={() => onConfirm(paymentMethod)}
        >
          Confirm Sale
        </button>

        <button
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
