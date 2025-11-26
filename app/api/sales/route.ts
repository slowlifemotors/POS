// app/api/sales/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

// -------------------------------------------------------------------
// SERVER SUPABASE CLIENT
// -------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session?.staff) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const staff_id = session.staff.id;

    const body = await req.json();

    const {
      customer_id,
      original_total,
      final_total,
      discount_id,
      payment_method,
      cart,
    } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------
    // INSERT SALE (DO NOT insert discount_amount because column doesn't exist)
    // -------------------------------------------------------------------
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        staff_id,
        customer_id: customer_id || null,
        original_total,
        final_total,
        discount_id: discount_id || null,
        payment_method,
      })
      .select("*")
      .single();

    if (saleErr) {
      console.error("Sale API Error (insert):", saleErr);
      return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }

    // -------------------------------------------------------------------
    // INSERT SALE ITEMS
    // -------------------------------------------------------------------
    const itemsToInsert = cart.map((item: any) => ({
      sale_id: sale.id,
      item_id: item.id,
      quantity: item.quantity,
      price_each: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: saleItemsErr } = await supabase
      .from("sale_items")
      .insert(itemsToInsert);

    if (saleItemsErr) {
      console.error("Sale API Error (sale_items):", saleItemsErr);
      return NextResponse.json({ error: saleItemsErr.message }, { status: 500 });
    }

    // -------------------------------------------------------------------
    // UPDATE STOCK
    // -------------------------------------------------------------------
    for (const item of cart) {
      await supabase
        .from("items")
        .update({
          stock: item.stock !== undefined
            ? item.stock - item.quantity
            : undefined,
        })
        .eq("id", item.id);
    }

    return NextResponse.json({
      success: true,
      sale_id: sale.id,
    });
  } catch (err: any) {
    console.error("Sale API Fatal Error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
