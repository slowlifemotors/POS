// app/pos/components/POSCart.tsx
"use client";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Discount = {
  id: number;
  name: string;
  percent: number;
} | null;

export default function POSCart({
  cart,
  updateQty,
  removeItem,
  originalTotal,
  discount,
  discountAmount,
  finalTotal,
}: {
  cart: CartItem[];
  updateQty: (id: string, amt: number) => void;
  removeItem: (id: string) => void;
  originalTotal: number;
  discount: Discount;
  discountAmount: number;
  finalTotal: number;
}) {
  return (
    <>
      <h2 className="text-2xl font-bold mb-4 text-slate-50">Cart</h2>

      <div className="max-h-[55vh] overflow-y-auto space-y-3">
        {cart.length === 0 ? (
          <p className="text-slate-500 mt-5 text-center">Cart is empty</p>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="p-3 border border-slate-700 rounded-lg flex justify-between items-center bg-slate-800"
            >
              <div>
                <p className="font-semibold text-slate-50">{item.name}</p>
                <p className="text-slate-300 text-sm">
                  ${item.price.toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
                  onClick={() => updateQty(item.id, -1)}
                >
                  -
                </button>

                <span className="font-semibold text-slate-50">
                  {item.quantity}
                </span>

                <button
                  className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600"
                  onClick={() => updateQty(item.id, +1)}
                >
                  +
                </button>
              </div>

              <button
                className="text-red-400 text-sm hover:text-red-300"
                onClick={() => removeItem(item.id)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-700 pt-4 mt-4">
        <p className="text-lg font-semibold text-slate-300">
          Subtotal: ${originalTotal.toFixed(2)}
        </p>

        {discount && (
          <p className="text-lg font-semibold text-amber-400">
            Discount: -${discountAmount.toFixed(2)}
          </p>
        )}

        <p className="text-xl font-bold text-slate-50 mt-1">
          Total: ${finalTotal.toFixed(2)}
        </p>
      </div>
    </>
  );
}
