// app/api/export/csv/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  // Permission check
  const session = await getSession();
  const staff = session?.staff;

  if (!staff || staff.permissions_level < 900) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // Fetch sales
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .order("id");

  if (salesErr) {
    console.error(salesErr);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }

  // Convert to CSV
  let csv = "Sale ID,Date,Staff ID,Customer ID,Original Total,Final Total,Payment,Item ID,Item Name,Quantity,Price\n";

  for (const sale of sales) {
    for (const item of sale.sale_items) {
      csv += [
        sale.id,
        sale.created_at,
        sale.staff_id,
        sale.customer_id || "",
        sale.original_total,
        sale.final_total,
        sale.payment_method,
        item.item_id,
        item.item_name,
        item.quantity,
        item.price
      ]
        .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
        .join(",") + "\n";
    }
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pos_export.csv"`
    }
  });
}
