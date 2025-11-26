//  app/api/customers/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ customers: [] });
    }

    // ----------------------------------------------------
    // 1. Search discounts by name or percent
    // ----------------------------------------------------
    const { data: discountMatches, error: discErr } = await supabase
      .from("discounts")
      .select("id, name, percent")
      .or(`name.ilike.%${q}%, percent::text.ilike.%${q}%`);

    if (discErr) console.error("Discount search error:", discErr);

    const discountIds = Array.isArray(discountMatches)
      ? discountMatches.map((d) => d.id)
      : [];

    // ----------------------------------------------------
    // 2. Search customers by name/phone
    // ----------------------------------------------------
    const {
      data: basicMatchesRaw,
      error: custErr1,
    } = await supabase
      .from("customers")
      .select("id, name, phone, email, discount_id")
      .or(`name.ilike.%${q}%, phone.ilike.%${q}%`)
      .order("name");

    if (custErr1) console.error("Customer basic search error:", custErr1);

    const basicMatches = Array.isArray(basicMatchesRaw)
      ? basicMatchesRaw
      : [];

    // ----------------------------------------------------
    // 3. Search customers by discount (if matched)
    // ----------------------------------------------------
    let discountCustomerMatches: any[] = [];

    if (discountIds.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, discount_id")
        .in("discount_id", discountIds);

      if (error) {
        console.error("Customer discount search error:", error);
      }

      discountCustomerMatches = Array.isArray(data) ? data : [];
    }

    // ----------------------------------------------------
    // 4. Merge results (unique by customer.id)
    // ----------------------------------------------------
    const safeBasic = Array.isArray(basicMatches) ? basicMatches : [];
    const safeDiscount = Array.isArray(discountCustomerMatches)
      ? discountCustomerMatches
      : [];

    const seen = new Set();
    const merged: any[] = [];

    for (const c of [...safeBasic, ...safeDiscount]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
    }

    return NextResponse.json({ customers: merged });
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ customers: [] });
  }
}
