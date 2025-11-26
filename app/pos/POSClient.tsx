"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AddCustomerModal from "./components/AddCustomerModal";

type Item = {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  category: string;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  discount_id: number | null;
};

type Discount = {
  id: number;
  name: string;
  percent: number;
};

type Tab = {
  id: number;
  name: string;
  amount: number;
  active: boolean;
};

export default function POSClient({
  staffId,
  staffName,
}: {
  staffId: number;
  staffName: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [discount, setDiscount] = useState<Discount | null>(null);

  // -------------------------------------------------------
  // Load Items
  // -------------------------------------------------------
  const loadItems = async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .order("name", { ascending: true });

    if (data) setItems(data);
  };

  // -------------------------------------------------------
  // Load Tabs
  // -------------------------------------------------------
  const loadTabs = async () => {
    const res = await fetch("/api/tabs?active=true");
    const json = await res.json();
    setTabs(Array.isArray(json.tabs) ? json.tabs : []);
  };

  useEffect(() => {
    loadItems();
    loadTabs();
  }, []);

  // -------------------------------------------------------
  // Filters
  // -------------------------------------------------------
  const accentColors: Record<string, string> = {
    Food: "#F97316",
    Drink: "#38BDF8",
    Alcohol: "#FB7185",
    Specials: "#A855F7",
  };

  const filteredItems = items.filter((item) => {
    const s = searchTerm.toLowerCase();
    return (
      (item.name.toLowerCase().includes(s) ||
        item.category.toLowerCase().includes(s) ||
        (item.barcode && item.barcode.includes(searchTerm))) &&
      (selectedCategory === "All" || item.category === selectedCategory)
    );
  });

  // -------------------------------------------------------
  // Cart
  // -------------------------------------------------------
  const addToCart = (item: Item) => {
    const exists = cart.find((c) => c.id === item.id);
    if (exists) {
      setCart(
        cart.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([
        ...cart,
        { id: item.id, name: item.name, price: item.price, quantity: 1 },
      ]);
    }
  };

  const updateQty = (id: number, amt: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + amt) }
            : item
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart(cart.filter((i) => i.id !== id));
  };

  // -------------------------------------------------------
  // Totals
  // -------------------------------------------------------
  const originalTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const discountPercent = discount ? discount.percent : 0;
  const discountAmount = (originalTotal * discountPercent) / 100;
  const finalTotal = parseFloat((originalTotal - discountAmount).toFixed(2));

  // -------------------------------------------------------
  // Checkout
  // -------------------------------------------------------
  const completeSale = async () => {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: staffId,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        original_total: originalTotal,
        final_total: finalTotal,
        discount_id: discount ? discount.id : null,
        payment_method: paymentMethod,
        cart,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      alert(result.error || "Sale failed");
      return;
    }

    await loadItems();
    await loadTabs();

    setCart([]);
    setIsCheckoutOpen(false);
    setSelectedCustomer(null);
    setDiscount(null);

    alert("Sale Completed!");
  };

  // -------------------------------------------------------
  // Customer select callback
  // -------------------------------------------------------
  const handleSelectCustomer = (customer: Customer, disc: Discount | null) => {
    setSelectedCustomer(customer);
    setDiscount(disc);
    setShowCustomerModal(false);
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      {/* ITEMS */}
      <div className="flex-1 pt-24 p-6 overflow-y-auto">
        <div className="flex gap-3 mb-4">
          {["All", "Food", "Drink", "Alcohol"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === cat
                  ? "bg-slate-50 text-slate-900 shadow"
                  : "bg-slate-800 text-slate-200 border border-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search items..."
          className="w-full p-3 rounded-lg mb-6 bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-400 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-slate-900 rounded-xl shadow hover:shadow-lg cursor-pointer transition transform hover:scale-[1.02] overflow-hidden border border-slate-700"
            >
              <div
                style={{ backgroundColor: accentColors[item.category] }}
                className="h-1.5 w-full"
              />
              <div className="p-4">
                <h2 className="font-semibold text-lg text-slate-50">
                  {item.name}
                </h2>
                <p className="text-slate-400 text-sm">{item.category}</p>
                <p className="mt-2 text-xl font-bold text-slate-50">
                  ${item.price.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CART */}
      <div className="w-[380px] bg-slate-900 shadow-xl border-l border-slate-700 p-5 flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-slate-50">Cart</h2>

        {/* SHOW CUSTOMER */}
        {selectedCustomer && (
          <div className="mb-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
            <p className="font-semibold text-fuchsia-400">
              Customer: {selectedCustomer.name}
            </p>
            {discount && (
              <p className="text-amber-400">
                Discount: {discount.percent}% OFF
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setShowCustomerModal(true)}
          className="w-full mb-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2 rounded-lg font-medium transition"
        >
          {selectedCustomer ? "Change Customer" : "Add Customer"}
        </button>

        <div className="flex-1 overflow-y-auto space-y-3">
          {cart.length === 0 ? (
            <p className="text-slate-500 mt-10 text-center">Cart is empty</p>
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

        <button
          onClick={() => setIsCheckoutOpen(true)}
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-lg font-semibold transition"
        >
          Checkout
        </button>
      </div>

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center">
          <div className="bg-slate-900 p-6 rounded-xl shadow-2xl w-[400px] border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-slate-50">
              Complete Sale
            </h2>

            <p className="text-lg mb-3 text-slate-50">
              Total: <strong>${finalTotal.toFixed(2)}</strong>
            </p>

            <label className="block mb-2 font-medium text-slate-200">
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-slate-700 bg-slate-800 text-slate-50 p-2 rounded mb-4"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>

              {tabs.map((t) => (
                <option key={t.id} value={`tab:${t.id}`}>
                  {t.name} Tab (${t.amount})
                </option>
              ))}
            </select>

            <button
              onClick={completeSale}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg mb-2 font-medium transition"
            >
              Confirm Sale
            </button>

            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-2 rounded-lg font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {showCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelectCustomer={handleSelectCustomer}
        />
      )}
    </div>
  );
}
