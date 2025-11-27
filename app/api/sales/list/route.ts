// app/api/sales/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("sales")
      .select(
        `
        id,
        staff_id,
        customer_id,
        final_total,
        created_at,
        staff:staff_id (
          name
        ),
        customer:customer_id (
          name
        )
      `
      )
      .order("id", { ascending: false });

    if (error) {
      console.error("Sales list error:", error);
      return NextResponse.json({ sales: [] });
    }

    // Normalize for frontend
    const formatted = (data || []).map((s: any) => ({
      id: s.id,
      staff_id: s.staff_id,
      staff_name: s.staff?.name || "Unknown",
      customer_id: s.customer_id,
      customer_name: s.customer?.name || null,
      final_total: s.final_total,
      created_at: s.created_at,
    }));

    return NextResponse.json({ sales: formatted });
  } catch (err) {
    console.error("Fatal error in list sales:", err);
    return NextResponse.json({ sales: [] });
  }
}
