// app/reports/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ============================================================
   TYPES
============================================================ */
type Sale = {
  id: number;
  staff_id: number;
  created_at: string;
  final_total: number;
  original_total: number;
  refunded: boolean;
};

type SaleItem = {
  sale_id: number;
  item_id: number;
  quantity: number;
  price_each: number;
  subtotal: number;
};

type Item = {
  id: number;
  name: string;
  cost_price: number;
  stock: number;
};

type Staff = {
  id: number;
  name: string;
  role_id: number;
};

type Role = {
  id: number;
  name: string;
  hourly_rate: number;
  commission_rate: number;
};

type Payment = {
  id: number;
  staff_id: number;
  period_end: string;
};

/* ============================================================
   PAGE COMPONENT
============================================================ */
export default function ReportsPage() {
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  /* ============================================================
     LOAD DATA
  ============================================================ */
  const loadData = async () => {
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    /* -------------------------
       1) SALES (filtered by date)
    ------------------------- */
    const { data: salesData } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end);

    const salesList = salesData || [];
    setSales(salesList);

    const saleIds = salesList.map((s) => s.id);

    /* -------------------------
       2) SALE ITEMS (using sale_ids)
    ------------------------- */
    let saleItemsList: SaleItem[] = [];

    if (saleIds.length > 0) {
      const { data: sItems } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds);
      saleItemsList = sItems || [];
    }

    setSaleItems(saleItemsList);

    /* -------------------------
       3) ITEMS (stock + cost)
    ------------------------- */
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, name, cost_price, stock");

    setItems(itemsData || []);

    /* -------------------------
       4) STAFF
    ------------------------- */
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, name, role_id");

    setStaff(staffData || []);

    /* -------------------------
       5) ROLES
    ------------------------- */
    const { data: roleData } = await supabase
      .from("roles")
      .select("id, name, hourly_rate, commission_rate");

    setRoles(roleData || []);

    /* -------------------------
       6) PAYMENTS (for owed calc)
    ------------------------- */
    const { data: paymentData } = await supabase
      .from("payments")
      .select("id, staff_id, period_end");

    setPayments(paymentData || []);
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  /* ============================================================
     CALCULATIONS
  ============================================================ */

  /* -------------------------
     TOTAL REVENUE
  ------------------------- */
  const totalRevenue = sales
    .filter((s) => !s.refunded)
    .reduce((t, s) => t + Number(s.final_total || 0), 0);

  /* -------------------------
     TOTAL SALES
  ------------------------- */
  const totalSalesCount = sales.filter((s) => !s.refunded).length;

  /* -------------------------
     TOTAL ITEMS SOLD
  ------------------------- */
  const totalItemsSold = saleItems.reduce(
    (sum, si) => sum + Number(si.quantity || 0),
    0
  );

  /* -------------------------
     TRUE PROFIT (COGS + proportional discount)
  ------------------------- */
  const totalProfit = (() => {
    let profit = 0;

    for (const sale of sales) {
      if (sale.refunded) continue;

      const itemsForSale = saleItems.filter((si) => si.sale_id === sale.id);
      if (itemsForSale.length === 0) continue;

      const original = Number(sale.original_total || 0);
      const final = Number(sale.final_total || 0);
      const discountLoss = Math.max(0, original - final);

      const sumSubtotals = itemsForSale.reduce(
        (s, si) => s + Number(si.subtotal || 0),
        0
      );
      if (sumSubtotals <= 0) continue;

      for (const si of itemsForSale) {
        const product = items.find((i) => i.id === si.item_id);
        if (!product) continue;

        const qty = Number(si.quantity || 0);
        const priceEach = Number(si.price_each || 0);
        const cost = Number(product.cost_price || 0);
        const subtotal = Number(si.subtotal || 0);

        const baseProfit = (priceEach - cost) * qty;
        const itemDiscountShare = (subtotal / sumSubtotals) * discountLoss;

        const itemProfit = Math.max(0, baseProfit - itemDiscountShare);
        profit += itemProfit;
      }
    }

    return profit;
  })();

  /* -------------------------
     STAFF REVENUE (simple)
  ------------------------- */
  const staffRevenue: Record<number, number> = {};
  sales.forEach((s) => {
    if (s.refunded) return;
    staffRevenue[s.staff_id] =
      (staffRevenue[s.staff_id] || 0) + Number(s.final_total || 0);
  });

  /* -------------------------
     TOP SELLING ITEMS
  ------------------------- */
  const topSelling = Object.values(
    saleItems.reduce((acc: any, si) => {
      if (!acc[si.item_id]) {
        const it = items.find((i) => i.id === si.item_id);
        if (it) acc[si.item_id] = { name: it.name, qty: 0 };
      }
      if (acc[si.item_id]) {
        acc[si.item_id].qty += Number(si.quantity || 0);
      }
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.qty - a.qty);

  /* -------------------------
     TOTAL OWED TO STAFF (commission only)
  ------------------------- */
  const totalOwed = (() => {
    let owed = 0;

    for (const person of staff) {
      const role = roles.find((r) => r.id === person.role_id);
      if (!role) continue;

      // Last payment → period start
      const last = payments
        .filter((p) => p.staff_id === person.id)
        .sort(
          (a, b) =>
            new Date(b.period_end).getTime() -
            new Date(a.period_end).getTime()
        )[0];

      const periodStart = last
        ? new Date(last.period_end)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const personSales = sales.filter((s) => {
        const d = new Date(s.created_at);
        return (
          s.staff_id === person.id &&
          !s.refunded &&
          d >= periodStart &&
          d <= new Date()
        );
      });

      let staffProfit = 0;

      for (const sale of personSales) {
        const itemsForSale = saleItems.filter((si) => si.sale_id === sale.id);
        if (itemsForSale.length === 0) continue;

        const original = Number(sale.original_total || 0);
        const final = Number(sale.final_total || 0);
        const discountLoss = original - final;

        const sumSubs = itemsForSale.reduce(
          (s, si) => s + Number(si.subtotal || 0),
          0
        );
        if (sumSubs <= 0) continue;

        for (const si of itemsForSale) {
          const product = items.find((i) => i.id === si.item_id);
          if (!product) continue;

          const qty = Number(si.quantity || 0);
          const baseProfit = (si.price_each - product.cost_price) * qty;
          const discountShare = (si.subtotal / sumSubs) * discountLoss;
          const itemProfit = Math.max(0, baseProfit - discountShare);

          staffProfit += itemProfit;
        }
      }

      owed += staffProfit * (role.commission_rate / 100);
    }

    return owed;
  })();

  /* -------------------------
     REORDER SUGGESTIONS
  ------------------------- */
  const reorderSuggestions = (() => {
    const soldMap: Record<number, number> = {};

    saleItems.forEach((si) => {
      soldMap[si.item_id] =
        (soldMap[si.item_id] || 0) + Number(si.quantity || 0);
    });

    return items.filter((item) => {
      const sold = soldMap[item.id] || 0;

      if (sold > 0) return item.stock <= sold * 0.1;

      return item.stock === 0;
    });
  })();

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pt-24 px-8 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end mb-10">
        <h2 className="text-3xl font-bold">Reports Dashboard</h2>

        <div className="flex gap-4">
          <div>
            <p className="text-sm text-slate-400">Start</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 bg-slate-900 border border-slate-700 rounded"
            />
          </div>
          <div>
            <p className="text-sm text-slate-400">End</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 bg-slate-900 border border-slate-700 rounded"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Total Revenue</p>
          <p className="text-3xl font-bold mt-2">${totalRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Total Profit</p>
          <p className="text-3xl font-bold mt-2">${totalProfit.toFixed(2)}</p>
        </div>

        <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Total Owed to Staff</p>
          <p className="text-3xl font-bold mt-2">${totalOwed.toFixed(2)}</p>
        </div>
      </div>

      {/* SALES STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Total Sales</p>
          <p className="text-2xl font-bold">{totalSalesCount}</p>
        </div>

        <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">Total Items Sold</p>
          <p className="text-2xl font-bold">{totalItemsSold}</p>
        </div>
      </div>

      {/* TOP SELLING ITEMS */}
      <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl mb-10">
        <h3 className="text-2xl font-bold mb-4">Top Selling Items</h3>
        {topSelling.length === 0 ? (
          <p className="text-slate-400">No items sold.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">Qty Sold</th>
              </tr>
            </thead>
            <tbody>
              {topSelling.map((row: any, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-slate-800 hover:bg-slate-800"
                >
                  <td className="p-3">{row.name}</td>
                  <td className="p-3">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* REORDER SUGGESTIONS */}
      <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl mb-10">
        <h3 className="text-2xl font-bold mb-4">Re-Order Suggestions</h3>
        {reorderSuggestions.length === 0 ? (
          <p className="text-slate-400">Nothing needs reordering.</p>
        ) : (
          <ul className="space-y-2">
            {reorderSuggestions.map((item) => (
              <li
                key={item.id}
                className="p-3 bg-slate-800 rounded border border-slate-700"
              >
                {item.name} — Stock: {item.stock}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
