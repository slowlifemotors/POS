// app/api/sales/void-sale/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  try {
    const { sale_id } = await req.json();

    if (!sale_id) {
      return NextResponse.json({ error: "Missing sale_id" }, { status: 400 });
    }

    // ----------------------------------------------------------
    // Fetch sale
    // ----------------------------------------------------------
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select("*")
      .eq("id", sale_id)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (sale.voided) {
      return NextResponse.json({ error: "Sale already voided" }, { status: 400 });
    }

    // ----------------------------------------------------------
    // Fetch all sale items
    // ----------------------------------------------------------
    const { data: items, error: itemsErr } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale_id);

    if (itemsErr || !items) {
      return NextResponse.json({ error: "Items not found" }, { status: 404 });
    }

    // ----------------------------------------------------------
    // If TAB payment, refund entire sale total
    // ----------------------------------------------------------
    if (sale.payment_method && sale.payment_method.startsWith("tab")) {
      const tabId = Number(sale.payment_method.replace(/\D/g, ""));

      if (!isNaN(tabId)) {
        await supabase.rpc("increment_tab_amount", {
          tab_id: tabId,
          amount_to_add: sale.final_total, // refund all
        });
      }
    }

    // ----------------------------------------------------------
    // RETURN STOCK FOR ALL NON-VOIDED ITEMS
    // ----------------------------------------------------------
    for (const item of items) {
      if (!item.voided) {
        await supabase.rpc("increment_item_stock", {
          item_id: item.item_id,
          qty: item.quantity,
        });
      }
    }

    // ----------------------------------------------------------
    // Mark all items voided
    // ----------------------------------------------------------
    await supabase
      .from("sale_items")
      .update({ voided: true })
      .eq("sale_id", sale_id);

    // ----------------------------------------------------------
    // Mark sale voided & set final_total to 0
    // ----------------------------------------------------------
    await supabase
      .from("sales")
      .update({
        voided: true,
        final_total: 0,
      })
      .eq("id", sale_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Void Sale Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
