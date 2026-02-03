// app/api/customers/from-staff/route.ts
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
    const staffId = Number(body.staff_id);

    if (!staffId) {
      return NextResponse.json({ error: "staff_id required" }, { status: 400 });
    }

    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .select("id, name, phone")
      .eq("id", staffId)
      .single();

    if (staffErr || !staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const name = (staff.name ?? "").trim();
    const phone = (staff.phone ?? "").trim() || null;

    // 1) Try find existing customer by phone (best key)
    if (phone) {
      const existing = await supabase
        .from("customers")
        .select(
          `
          id,
          name,
          phone,
          discount_id,
          is_blacklisted,
          blacklist_reason,
          blacklist_start,
          blacklist_end
        `
        )
        .eq("phone", phone)
        .maybeSingle();

      if (!existing.error && existing.data) {
        return NextResponse.json({ customer: existing.data });
      }
    }

    // 2) Otherwise, try match by exact name (optional)
    if (name) {
      const existingByName = await supabase
        .from("customers")
        .select(
          `
          id,
          name,
          phone,
          discount_id,
          is_blacklisted,
          blacklist_reason,
          blacklist_start,
          blacklist_end
        `
        )
        .eq("name", name)
        .maybeSingle();

      if (!existingByName.error && existingByName.data) {
        return NextResponse.json({ customer: existingByName.data });
      }
    }

    // 3) Create customer
    const created = await supabase
      .from("customers")
      .insert({
        name: name || `Staff #${staffId}`,
        phone: phone,
        discount_id: null,
        is_blacklisted: false,
        blacklist_reason: null,
        blacklist_start: null,
        blacklist_end: null,
      })
      .select(
        `
        id,
        name,
        phone,
        discount_id,
        is_blacklisted,
        blacklist_reason,
        blacklist_start,
        blacklist_end
      `
      )
      .single();

    if (created.error) {
      console.error("Create customer from staff error:", created.error);
      return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
    }

    return NextResponse.json({ customer: created.data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
