// app/jobs/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import JobsClient from "./components/JobsClient";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

type OrderRow = {
  id: string;
  status: string;
  vehicle_id: number;
  staff_id: number;
  customer_id: number | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  note: string | null;
  created_at: string;
  plate?: string | null; // ✅ NEW
  voided_at?: string | null;
  void_reason?: string | null;
  voided_by_staff_id?: number | null;
};

type OrderLineRow = {
  id?: string;
  order_id: string;
  mod_name: string;
  quantity: number;
  unit_price: number;
  pricing_type: "percentage" | "flat" | string | null;
  pricing_value: number | null;
  created_at?: string;
  is_voided?: boolean;
  void_reason?: string | null;
  voided_at?: string | null;
};

export default async function JobsPage() {
  const session = await getSession();

  if (!session?.staff) redirect("/login");
  if (!isManagerOrAbove(session.staff.role)) redirect("/pos");

  const { data: orders, error: ordersErr } = await supabaseServer
    .from("orders")
    .select(
      "id, status, vehicle_id, staff_id, customer_id, subtotal, discount_amount, total, note, created_at, plate, voided_at, void_reason, voided_by_staff_id"
    )
    .in("status", ["paid", "void"])
    .order("created_at", { ascending: false })
    .limit(200);

  const safeOrders = (orders ?? []) as OrderRow[];

  const orderIds = safeOrders.map((o) => o.id);

  const { data: lines, error: linesErr } =
    orderIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer
          .from("order_lines")
          .select(
            "id, order_id, mod_name, quantity, unit_price, pricing_type, pricing_value, created_at, is_voided, void_reason, voided_at"
          )
          .in("order_id", orderIds)
          .order("created_at", { ascending: true });

  const safeLines = (lines ?? []) as OrderLineRow[];

  const linesByOrderId = new Map<string, OrderLineRow[]>();
  for (const l of safeLines) {
    const arr = linesByOrderId.get(l.order_id) ?? [];
    arr.push(l);
    linesByOrderId.set(l.order_id, arr);
  }

  const vehicleIds = Array.from(new Set(safeOrders.map((o) => o.vehicle_id)));
  const { data: vehicles, error: vehiclesErr } =
    vehicleIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer.from("vehicles").select("id, manufacturer, model").in("id", vehicleIds);

  const vehicleNameById = new Map<number, string>();
  (vehicles ?? []).forEach((v: any) => {
    const manufacturer = String(v?.manufacturer ?? "").trim();
    const model = String(v?.model ?? "").trim();
    const label = [manufacturer, model].filter(Boolean).join(" ") || `Vehicle #${v.id}`;
    vehicleNameById.set(Number(v.id), label);
  });

  const staffIds = Array.from(new Set(safeOrders.map((o) => o.staff_id)));
  const { data: staffRows, error: staffErr } =
    staffIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer.from("staff").select("id, name, username").in("id", staffIds);

  const staffNameById = new Map<number, string>();
  (staffRows ?? []).forEach((s: any) => {
    const label = String(s?.name ?? "").trim() || String(s?.username ?? "").trim() || `Staff #${s.id}`;
    staffNameById.set(Number(s.id), label);
  });

  const customerIds = Array.from(
    new Set(safeOrders.map((o) => o.customer_id).filter((id): id is number => typeof id === "number"))
  );

  const { data: customers, error: customersErr } =
    customerIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer.from("customers").select("id, name").in("id", customerIds);

  const customerNameById = new Map<number, string>();
  (customers ?? []).forEach((c: any) => {
    const label = String(c?.name ?? "").trim() || `Customer #${c.id}`;
    customerNameById.set(Number(c.id), label);
  });

  const bannerWarnings: string[] = [];
  if (ordersErr) bannerWarnings.push("Failed to load orders.");
  if (linesErr) bannerWarnings.push("Failed to load order lines.");
  if (vehiclesErr) bannerWarnings.push("Failed to load vehicle names.");
  if (staffErr) bannerWarnings.push("Failed to load staff names.");
  if (customersErr) bannerWarnings.push("Failed to load customer names.");

  return (
    <JobsClient
      sessionStaff={{
        id: session.staff.id,
        username: session.staff.username,
        role: session.staff.role,
      }}
      orders={safeOrders}
      linesByOrderId={Object.fromEntries(linesByOrderId.entries())}
      vehicleNameById={Object.fromEntries(vehicleNameById.entries())}
      staffNameById={Object.fromEntries(staffNameById.entries())}
      customerNameById={Object.fromEntries(customerNameById.entries())}
      bannerWarnings={bannerWarnings}
    />
  );
}
