// app/api/customers/edit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    const updateData: any = {
      // Core
      name: body.name ?? "",
      phone: body.phone ?? null,
      email: body.email ?? null,
      discount_id: body.discount_id ?? null,

      // Voucher / Membership / Notes
      voucher_amount: body.voucher_amount ?? 0,
      membership_active: body.membership_active ?? false,
      membership_start: body.membership_start ?? null,
      membership_end: body.membership_end ?? null,
      note: body.note ?? null,

      // Blacklist
      is_blacklisted: body.is_blacklisted ?? false,
      blacklist_reason: body.blacklist_reason ?? null,
      blacklist_start: body.blacklist_start ?? null,
      blacklist_end: body.blacklist_end ?? null,
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      console.error("Customer edit error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (err) {
    console.error("Customer EDIT error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
