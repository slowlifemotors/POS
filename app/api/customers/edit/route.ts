// app/api/customers/edit/route.ts
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

function toNullIfBlank(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toBool(v: unknown) {
  return Boolean(v);
}

function toNumberOrZero(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (!body?.id) {
      return jsonError("Missing customer ID", 400);
    }

    // IMPORTANT: normalize blanks -> null (prevents date columns getting "")
    const membership_active = toBool(body.membership_active);
    const membership_start = membership_active ? toNullIfBlank(body.membership_start) : null;
    const membership_end = membership_active ? toNullIfBlank(body.membership_end) : null;

    const is_blacklisted = toBool(body.is_blacklisted);
    const blacklist_start = is_blacklisted ? toNullIfBlank(body.blacklist_start) : null;
    const blacklist_end = is_blacklisted ? toNullIfBlank(body.blacklist_end) : null;
    const blacklist_reason = is_blacklisted ? toNullIfBlank(body.blacklist_reason) : null;

    // If membership is on, enforce both dates
    if (membership_active) {
      if (!membership_start || !membership_end) {
        return jsonError("Membership start and end dates are required.", 400);
      }
      if (membership_end < membership_start) {
        return jsonError("Membership end date cannot be before start date.", 400);
      }
    }

    // If blacklist is on, enforce required fields
    if (is_blacklisted) {
      if (!blacklist_reason) {
        return jsonError("Blacklist reason is required.", 400);
      }
      if (!blacklist_start || !blacklist_end) {
        return jsonError("Blacklist start and end dates are required.", 400);
      }
      if (blacklist_end < blacklist_start) {
        return jsonError("Blacklist end date cannot be before start date.", 400);
      }
    }

    const updateData: any = {
      // Core
      name: String(body.name ?? "").trim(),
      phone: toNullIfBlank(body.phone),
      // NOTE: only keep this if the column exists in Supabase:
      // email: toNullIfBlank(body.email),

      discount_id: body.discount_id ?? null,

      // Voucher / Membership / Notes
      voucher_amount: toNumberOrZero(body.voucher_amount),
      membership_active,
      membership_start,
      membership_end,
      note: toNullIfBlank(body.note),

      // Blacklist
      is_blacklisted,
      blacklist_reason,
      blacklist_start,
      blacklist_end,
    };

    if (!updateData.name) {
      return jsonError("Customer name is required.", 400);
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      console.error("Customer edit error:", error);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ customer: data });
  } catch (err) {
    console.error("Customer EDIT error:", err);
    return jsonError("Server error", 500);
  }
}
