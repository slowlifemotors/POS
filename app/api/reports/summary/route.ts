// app/api/reports/summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

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
  commission_rate: number;
};

type Payment = {
  id: number;
  staff_id: number;
  period_end: string;
};

/* ============================================================
   GET HANDLER
============================================================ */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = `${searchParams.get("start")} 00:00:00`;
  const end = `${searchParams.get("end")} 23:59:59`;

  if (!searchParams.get("start") || !searchParams.get("end")) {
    return NextResponse.json(
      { error: "start and end dates required" },
      { status: 400 }
    );
  }

  /* ------------------------------------------------------------
     LOAD SALES WITH DATE FILTER
  ------------------------------------------------------------ */
  const { data: salesData } = await supabase
    .from("sales")
    .select("*")
    .gte("created_at", start)
    .lte("created_at", end);

  const sales: Sale[] = salesData || [];
  const saleIds = sales.map((s) => s.id);

  /* ------------------------------------------------------------
     LOAD SALE ITEMS (FILTERED BY sale_id)
  ------------------------------------------------------------ */
  let saleItems: SaleItem[] = [];
  if (saleIds.length > 0) {
    const { data: sItems } = await supabase
      .from("sale_items")
      .select("*")
      .in("sale_id", saleIds);

    saleItems = sItems || [];
  }

  /* ------------------------------------------------------------
     LOAD ITEMS
  ------------------------------------------------------------ */
  const { data: itemsData } = await supabase
    .from("items")
    .select("id, name, cost_price, stock");

  const items: Item[] = itemsData || [];

  /* ------------------------------------------------------------
     LOAD STAFF
  ------------------------------------------------------------ */
  const { data: staffData } = await supabase
    .from("staff")
    .select("id, name, role_id");

  const staff: Staff[] = staffData || [];

  /* ------------------------------------------------------------
     LOAD ROLES
  ------------------------------------------------------------ */
  const { data: roleData } = await supabase
    .from("roles")
    .select("id, commission_rate");

  const roles: Role[] = roleData || [];

  /* ------------------------------------------------------------
     LOAD PAYMENTS (for owed)
  ------------------------------------------------------------ */
  const { data: paymentData } = await supabase
    .from("payments")
    .select("id, staff_id, period_end");

  const payments: Payment[] = paymentData || [];

  /* ============================================================
     CALCULATIONS
  ============================================================ */

  /* --------------------------
     TOTAL REVENUE
  -------------------------- */
  const totalRevenue = sales
    .filter((s) => !s.refunded)
    .reduce((sum, s) => sum + Number(s.final_total || 0), 0);

  /* --------------------------
     TOTAL SALES COUNT
  -------------------------- */
  const totalSales = sales.filter((s) => !s.refunded).length;

  /* --------------------------
     TOTAL ITEMS SOLD
  -------------------------- */
  const totalItemsSold = saleItems.reduce(
    (s, si) => s + Number(si.quantity || 0),
    0
  );

  /* --------------------------
     TOTAL PROFIT (COGS)
  -------------------------- */
  const totalProfit = (() => {
    let profit = 0;

    for (const sale of sales) {
      if (sale.refunded) continue;

      const itemsForSale = saleItems.filter((i) => i.sale_id === sale.id);
      if (itemsForSale.length === 0) continue;

      const original = Number(sale.original_total || 0);
      const final = Number(sale.final_total || 0);
      const discountLoss = Math.max(0, original - final);

      const sumSubs = itemsForSale.reduce(
        (t, i) => t + Number(i.subtotal || 0),
        0
      );
      if (sumSubs <= 0) continue;

      for (const si of itemsForSale) {
        const product = items.find((p) => p.id === si.item_id);
        if (!product) continue;

        const qty = Number(si.quantity || 0);
        const baseProfit = (si.price_each - product.cost_price) * qty;
        const discountShare = (si.subtotal / sumSubs) * discountLoss;
        profit += Math.max(0, baseProfit - discountShare);
      }
    }

    return profit;
  })();

  /* --------------------------
     STAFF REVENUE
  -------------------------- */
  const staffRevenue = sales.reduce((acc: any, sale) => {
    if (sale.refunded) return acc;
    acc[sale.staff_id] = (acc[sale.staff_id] || 0) + sale.final_total;
    return acc;
  }, {});

  /* --------------------------
     TOP SELLING ITEMS
  -------------------------- */
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

  /* --------------------------
     TOTAL OWED TO STAFF
  -------------------------- */
  const totalOwed = (() => {
    let owed = 0;

    for (const person of staff) {
      const role = roles.find((r) => r.id === person.role_id);
      if (!role) continue;

      // Last payment per staff
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

      const salesForStaff = sales.filter((s) => {
        const d = new Date(s.created_at);
        return (
          s.staff_id === person.id &&
          !s.refunded &&
          d >= periodStart &&
          d <= new Date()
        );
      });

      let staffProfit = 0;

      for (const sale of salesForStaff) {
        const itemsForSale = saleItems.filter((i) => i.sale_id === sale.id);
        if (itemsForSale.length === 0) continue;

        const original = Number(sale.original_total || 0);
        const final = Number(sale.final_total || 0);
        const discountLoss = Math.max(0, original - final);

        const sumSubs = itemsForSale.reduce(
          (t, i) => t + Number(i.subtotal || 0),
          0
        );
        if (sumSubs <= 0) continue;

        for (const si of itemsForSale) {
          const product = items.find((p) => p.id === si.item_id);
          if (!product) continue;

          const qty = Number(si.quantity || 0);
          const baseProfit = (si.price_each - product.cost_price) * qty;
          const discountShare = (si.subtotal / sumSubs) * discountLoss;
          staffProfit += Math.max(0, baseProfit - discountShare);
        }
      }

      owed += staffProfit * (role.commission_rate / 100);
    }

    return owed;
  })();

  /* --------------------------
     REORDER SUGGESTIONS
  -------------------------- */
  const reorderSuggestions = (() => {
    const soldMap: Record<number, number> = {};

    saleItems.forEach((si) => {
      soldMap[si.item_id] =
        (soldMap[si.item_id] || 0) + Number(si.quantity || 0);
    });

    return items.filter((item) => {
      const sold = soldMap[item.id] || 0;

      // sold > 0 → stock <= 10% of sold
      if (sold > 0) return item.stock <= sold * 0.1;

      // sold = 0 → reorder only if stock = 0
      return item.stock === 0;
    });
  })();

  /* ============================================================
     RESPONSE
  ============================================================ */
  return NextResponse.json({
    date_range: {
      start,
      end,
    },
    totals: {
      revenue: totalRevenue,
      profit: totalProfit,
      sales: totalSales,
      items_sold: totalItemsSold,
      owed_to_staff: totalOwed,
    },
    staff_revenue: staffRevenue,
    top_selling: topSelling,
    reorder_suggestions: reorderSuggestions,
    raw: {
      sales,
      sale_items: saleItems,
      items,
    },
  });
}
