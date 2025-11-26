//  app/api/customers/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// ========================================================
// GET — list all customers
// ========================================================
export async function GET() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, email, discount_id")
    .order("name");

  if (error) {
    console.error("Customer load error:", error);
    return NextResponse.json({ customers: [] });
  }

  return NextResponse.json({ customers: data });
}

// ========================================================
// POST — create customer
// ========================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const newCustomer = {
      name: body.name ?? "",
      phone: body.phone ?? null,
      email: body.email ?? null,
      discount_id: body.discount_id ?? null,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(newCustomer)
      .select("*")
      .single();

    if (error) {
      console.error("Customer create error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (err) {
    console.error("Customer POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ========================================================
// PUT — update customer
// ========================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing customer ID" },
        { status: 400 }
      );
    }

    const updates = {
      name: body.name ?? "",
      phone: body.phone ?? null,
      email: body.email ?? null,
      discount_id: body.discount_id ?? null,
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      console.error("Customer update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (err) {
    console.error("Customer PUT error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ========================================================
// DELETE — delete customer
// ========================================================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", Number(id));

    if (error) {
      console.error("Customer delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Customer DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
