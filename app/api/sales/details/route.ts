// app/api/sales/details/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Types for Supabase join handling
type JoinedName = { name: string } | null | undefined;

interface SaleWithJoins {
  id: number;
  staff_id: number | null;
  customer_id: number | null;
  payment_method: string | null;
  final_total: number;
  original_total: number;
  created_at: string;

  staff?: JoinedName[] | JoinedName | null;
  customer?: JoinedName[] | JoinedName | null;
}

interface SaleItemWithJoin {
  id: number;
  sale_id: number;
  item_id: number;
  quantity: number;
  price_each: number;
  subtotal: number;
  voided: boolean;

  item?: JoinedName[] | JoinedName | null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "Missing sale ID" }, { status: 400 });
    }

    // -----------------------------------------
    // FETCH SALE
    // -----------------------------------------
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select(
        `
        id,
        staff_id,
        customer_id,
        payment_method,
        final_total,
        original_total,
        created_at,
        staff:staff_id ( name ),
        customer:customer_id ( name )
      `
      )
      .eq("id", id)
      .single<SaleWithJoins>();

    if (saleErr || !sale) {
      console.error("Sale details error:", saleErr);
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Normalize joined values
    const extractName = (joined: SaleWithJoins["staff"]) => {
      if (Array.isArray(joined)) return joined[0]?.name ?? null;
      return joined?.name ?? null;
    };

    const staffName = extractName(sale.staff) ?? "Unknown";
    const customerName = extractName(sale.customer) ?? "Guest";

    // -----------------------------------------
    // FETCH ITEMS WITH JOIN
    // -----------------------------------------
    const { data: items, error: itemsErr } = await supabase
      .from("sale_items")
      .select(
        `
        id,
        sale_id,
        item_id,
        quantity,
        price_each,
        subtotal,
        voided,
        item:item_id ( name )
      `
      )
      .eq("sale_id", id)
      .returns<SaleItemWithJoin[]>();

    if (itemsErr) console.error("Sale items error:", itemsErr);

    const extractItemName = (joined: SaleItemWithJoin["item"]) => {
      if (Array.isArray(joined)) return joined[0]?.name ?? null;
      return joined?.name ?? null;
    };

    // -----------------------------------------
    // SPLIT QUANTITY INTO INDIVIDUAL ROWS
    // -----------------------------------------
    const splitItems: any[] = [];

    (items ?? []).forEach((i) => {
      const itemName = extractItemName(i.item) ?? "Unknown Item";

      for (let x = 0; x < i.quantity; x++) {
        splitItems.push({
          id: i.id,
          item_id: i.item_id,
          item_name: itemName,
          quantity: 1,
          price_each: i.price_each,
          subtotal: i.price_each,
          voided: i.voided,
        });
      }
    });

    // -----------------------------------------
    // SEND FULL RESPONSE
    // -----------------------------------------
    return NextResponse.json({
      sale: {
        id: sale.id,
        staff_id: sale.staff_id,
        staff_name: staffName,
        customer_id: sale.customer_id,
        customer_name: customerName,
        payment_method: sale.payment_method,
        final_total: sale.final_total,
        original_total: sale.original_total,
        created_at: sale.created_at,
      },
      items: splitItems,
    });
  } catch (err) {
    console.error("Fatal error in sale details:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
