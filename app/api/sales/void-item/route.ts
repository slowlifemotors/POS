// app/api/sales/void-item/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const { item_id } = await req.json();

    if (!item_id) {
      return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }

    // ---------------------------------------------
    // FETCH ITEM ROW
    // ---------------------------------------------
    const { data: item, error: itemErr } = await supabase
      .from("sale_items")
      .select("*")
      .eq("id", item_id)
      .single();

    if (itemErr || !item)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (item.voided)
      return NextResponse.json({ error: "Already voided" }, { status: 400 });

    // ---------------------------------------------
    // FETCH SALE
    // ---------------------------------------------
    const { data: sale } = await supabase
      .from("sales")
      .select("*")
      .eq("id", item.sale_id)
      .single();

    if (!sale)
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    // ---------------------------------------------
    // TAB REFUND
    // ---------------------------------------------
    if (sale.payment_method?.toLowerCase().startsWith("tab")) {
      const tabId = Number(sale.payment_method.replace(/\D/g, ""));
      if (!isNaN(tabId)) {
        await supabase
          .from("tabs")
          .update({
            amount: sale.final_total - item.price_each,
          })
          .eq("id", tabId);
      }
    }

    // ---------------------------------------------
    // RESTOCK 1 UNIT
    // ---------------------------------------------
    const currentStock = await getItemStock(item.item_id);
    await supabase
      .from("items")
      .update({ stock: currentStock + 1 })
      .eq("id", item.item_id);

    // ---------------------------------------------
    // VOID THE WHOLE ROW (same behavior)
    // ---------------------------------------------
    await supabase
      .from("sale_items")
      .update({
        voided: true,
        subtotal: item.subtotal - item.price_each,
        quantity: item.quantity - 1
      })
      .eq("id", item_id);

    // ---------------------------------------------
    // UPDATE SALE TOTAL
    // ---------------------------------------------
    const newTotal = Math.max(0, sale.final_total - item.price_each);

    await supabase
      .from("sales")
      .update({ final_total: newTotal })
      .eq("id", sale.id);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Void Item Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function getItemStock(itemId: number) {
  const { data } = await supabase
    .from("items")
    .select("stock")
    .eq("id", itemId)
    .single();

  return Number(data?.stock ?? 0);
}
