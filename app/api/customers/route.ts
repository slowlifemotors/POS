// app/api/customers/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function toIntId(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// Keep the select consistent everywhere (POS relies on these fields existing)
const CUSTOMER_SELECT = `
  id,
  name,
  phone,
  discount_id,
  voucher_amount,
  membership_active,
  membership_start,
  membership_end,
  note,
  is_blacklisted,
  blacklist_start,
  blacklist_end,
  blacklist_reason
`;

/* ======================================================
   GET — list customers (or one by id)
====================================================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    // Optional: fetch one customer by id
    if (idParam) {
      const id = toIntId(idParam);
      if (!id) return jsonError("Invalid customer id", 400);

      const { data, error } = await supabase
        .from("customers")
        .select(CUSTOMER_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Customer GET(id) error:", error);
        return jsonError(error.message, 500);
      }

      return NextResponse.json({ customer: data ?? null }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .order("name", { ascending: true });

    if (error) {
      console.error("Customer load error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ customers: data ?? [] }, { status: 200 });
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

    const voucherAmountRaw = Number(body?.voucher_amount ?? 0);
    const voucher_amount = Number.isFinite(voucherAmountRaw) ? voucherAmountRaw : 0;

    const membership_active = Boolean(body?.membership_active ?? false);
    const membership_start = membership_active ? (body?.membership_start ?? null) : null;
    const membership_end = membership_active ? (body?.membership_end ?? null) : null;

    const note =
      typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const insertRow = {
      name,
      phone,
      discount_id: body?.discount_id ?? null,
      voucher_amount,
      membership_active,
      membership_start,
      membership_end,
      note,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(insertRow)
      .select(CUSTOMER_SELECT)
      .single();

    if (error) {
      console.error("Customer create error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ customer: data }, { status: 200 });
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

    const id = toIntId(body?.id);
    if (!id) return jsonError("Valid customer id is required for update", 400);

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

    if (body?.voucher_amount !== undefined) {
      const v = Number(body.voucher_amount);
      patch.voucher_amount = Number.isFinite(v) ? v : 0;
    }

    if (body?.membership_active !== undefined) patch.membership_active = Boolean(body.membership_active);

    if (body?.membership_start !== undefined) patch.membership_start = body.membership_start ?? null;
    if (body?.membership_end !== undefined) patch.membership_end = body.membership_end ?? null;

    // If membership is being disabled, force-clear dates (prevents stale dates)
    if (body?.membership_active !== undefined && !Boolean(body.membership_active)) {
      patch.membership_start = null;
      patch.membership_end = null;
    }

    if (body?.note !== undefined) {
      patch.note =
        typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    }

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
      .select(CUSTOMER_SELECT)
      .maybeSingle();

    if (error) {
      console.error("Customer update error:", error);
      return jsonError(error.message, 500);
    }

    if (!data) return jsonError("Customer not found", 404);

    return NextResponse.json({ customer: data }, { status: 200 });
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
    const idParam = searchParams.get("id");
    const id = toIntId(idParam);

    if (!id) return jsonError("Customer ID required", 400);

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("Customer delete error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error("Customer DELETE route error:", e);
    return jsonError(e?.message ?? "Server error", 500);
  }
}
