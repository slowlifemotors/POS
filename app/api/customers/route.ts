// app/api/customers/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

/* ======================================================
   GET — list customers (or one by id)
====================================================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Optional: fetch one customer by id
    if (id) {
      const { data, error } = await supabase
        .from("customers")
        .select(
          `
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
        `
        )
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Customer GET(id) error:", error);
        return jsonError(error.message, 500);
      }

      return NextResponse.json({ customer: data ?? null });
    }

    const { data, error } = await supabase
      .from("customers")
      .select(
        `
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
      `
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("Customer load error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ customers: data ?? [] });
  } catch (e: any) {
    console.error("Customer GET route error:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}

/* ======================================================
   POST — create customer
====================================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name ?? "").trim();
    if (!name) return jsonError("Name is required", 400);

    const phone =
      typeof body?.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;

    const insertRow = {
      name,
      phone,
      discount_id: body?.discount_id ?? null,
      voucher_amount: body?.voucher_amount ?? 0,
      membership_active: body?.membership_active ?? false,
      membership_start: body?.membership_start ?? null,
      membership_end: body?.membership_end ?? null,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(insertRow)
      .select(
        `
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
      `
      )
      .single();

    if (error) {
      console.error("Customer create error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ customer: data });
  } catch (e: any) {
    console.error("Customer POST route error:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}

/* ======================================================
   PUT — update customer (SAFE + PARTIAL)
====================================================== */
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const idRaw = body?.id;
    const id = Number(idRaw);

    if (!Number.isFinite(id) || id <= 0) {
      return jsonError("Valid customer id is required for update", 400);
    }

    // Only update fields that were actually provided
    const patch: Record<string, any> = {};

    if (body?.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Name cannot be empty", 400);
      patch.name = name;
    }

    if (body?.phone !== undefined) {
      patch.phone =
        typeof body.phone === "string" && body.phone.trim()
          ? body.phone.trim()
          : null;
    }

    if (body?.discount_id !== undefined) patch.discount_id = body.discount_id ?? null;

    if (body?.voucher_amount !== undefined) patch.voucher_amount = Number(body.voucher_amount) || 0;

    if (body?.membership_active !== undefined) patch.membership_active = Boolean(body.membership_active);
    if (body?.membership_start !== undefined) patch.membership_start = body.membership_start ?? null;
    if (body?.membership_end !== undefined) patch.membership_end = body.membership_end ?? null;

    if (body?.is_blacklisted !== undefined) patch.is_blacklisted = Boolean(body.is_blacklisted);
    if (body?.blacklist_start !== undefined) patch.blacklist_start = body.blacklist_start ?? null;
    if (body?.blacklist_end !== undefined) patch.blacklist_end = body.blacklist_end ?? null;
    if (body?.blacklist_reason !== undefined) patch.blacklist_reason = body.blacklist_reason ?? null;

    if (Object.keys(patch).length === 0) {
      return jsonError("No fields provided to update", 400);
    }

    const { data, error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .select(
        `
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
      `
      )
      .maybeSingle();

    if (error) {
      console.error("Customer update error:", error);
      return jsonError(error.message, 500);
    }

    if (!data) {
      return jsonError("Customer not found", 404);
    }

    return NextResponse.json({ customer: data });
  } catch (e: any) {
    console.error("Customer PUT route error:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}

/* ======================================================
   DELETE — delete customer
====================================================== */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return jsonError("Customer ID required", 400);

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("Customer delete error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Customer DELETE route error:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}
