// app/api/customers/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  discount_id: number | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  blacklist_start: string | null;
  blacklist_end: string | null;
};

type StaffRow = {
  id: number;
  name: string;
  username: string | null;
  active: boolean | null;
};

function normName(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ results: [] });

    // 1) Customers (name/phone)
    const { data: customersRaw, error: custErr } = await supabase
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
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order("name");

    if (custErr) console.error("Customer search error:", custErr);

    const customers = (Array.isArray(customersRaw) ? customersRaw : []) as CustomerRow[];

    // 2) Staff (name/username)
    const { data: staffRaw, error: staffErr } = await supabase
      .from("staff")
      .select(`id, name, username, active`)
      .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
      .order("name");

    if (staffErr) console.error("Staff search error:", staffErr);

    const staff = (Array.isArray(staffRaw) ? staffRaw : []) as StaffRow[];

    // 3) If a person is in BOTH staff + customers, show ONLY the staff entry
    const staffNameSet = new Set(staff.map((s) => normName(s.name)));

    const customersFiltered = customers.filter((c) => {
      const n = normName(c.name);
      return !staffNameSet.has(n);
    });

    // 4) Merge
    const results = [
      ...customersFiltered.map((c) => ({
        type: "customer" as const,
        id: c.id,
        name: c.name,
        phone: c.phone,
        discount_id: c.discount_id,
        is_blacklisted: c.is_blacklisted ?? false,
        blacklist_reason: c.blacklist_reason ?? null,
        blacklist_start: c.blacklist_start ?? null,
        blacklist_end: c.blacklist_end ?? null,
      })),
      ...staff.map((s) => ({
        type: "staff" as const,
        id: s.id,
        name: s.name,
        phone: null,
        discount_id: null,
        is_blacklisted: false,
        blacklist_reason: null,
        blacklist_start: null,
        blacklist_end: null,
        username: s.username ?? null,
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ results: [] });
  }
}
