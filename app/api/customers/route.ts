import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/* ======================================================
   GET — list customers
====================================================== */
export async function GET() {
  const { data, error } = await supabase
    .from("customers")
    .select(`
      id,
      name,
      phone,
      discount_id,
      voucher_amount,
      membership_active,
      membership_start,
      membership_end,
      is_blacklisted,
      blacklist_start,
      blacklist_end,
      blacklist_reason
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("Customer load error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ customers: data });
}

/* ======================================================
   POST — create customer
====================================================== */
export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabase.from("customers").insert({
    name: body.name,
    phone: body.phone || null,
    discount_id: body.discount_id ?? null,
    voucher_amount: body.voucher_amount ?? 0,
    membership_active: body.membership_active ?? false,
    membership_start: body.membership_start ?? null,
    membership_end: body.membership_end ?? null,
  });

  if (error) {
    console.error("Customer create error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ======================================================
   PUT — update customer
====================================================== */
export async function PUT(req: Request) {
  const body = await req.json();

  const { error } = await supabase
    .from("customers")
    .update({
      name: body.name,
      phone: body.phone || null,
      discount_id: body.discount_id ?? null,
      voucher_amount: body.voucher_amount ?? 0,
      membership_active: body.membership_active ?? false,
      membership_start: body.membership_start ?? null,
      membership_end: body.membership_end ?? null,
      is_blacklisted: body.is_blacklisted ?? false,
      blacklist_start: body.blacklist_start ?? null,
      blacklist_end: body.blacklist_end ?? null,
      blacklist_reason: body.blacklist_reason ?? null,
    })
    .eq("id", body.id);

  if (error) {
    console.error("Customer update error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ======================================================
   DELETE — delete customer
====================================================== */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Customer ID required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Customer delete error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
