// app/jobs/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function roleLower(role: unknown) {
  return typeof role === "string" ? role.toLowerCase().trim() : "";
}

function isManagerOrAbove(role: unknown) {
  const r = roleLower(role);
  return r === "owner" || r === "admin" || r === "manager";
}

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(2);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type OrderRow = {
  id: string;
  status: "paid" | "void" | string;
  vehicle_id: number;
  staff_id: number;
  customer_id: number | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  note: string | null;
  created_at: string;
};

type OrderLineRow = {
  order_id: string;
  mod_name: string;
  quantity: number;
  unit_price: number;
  pricing_type: "percentage" | "flat" | string | null;
  pricing_value: number | null;
};

export default async function JobsPage() {
  const session = await getSession();

  if (!session?.staff) {
    redirect("/login");
  }

  if (!isManagerOrAbove(session.staff.role)) {
    redirect("/pos");
  }

  // Load latest PAID jobs (orders)
  const { data: orders, error: ordersErr } = await supabaseServer
    .from("orders")
    .select("id, status, vehicle_id, staff_id, customer_id, subtotal, discount_amount, total, note, created_at")
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(200);

  const safeOrders = (orders ?? []) as OrderRow[];

  // Load order lines for the returned orders
  const orderIds = safeOrders.map((o) => o.id);

  const { data: lines, error: linesErr } =
    orderIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer
          .from("order_lines")
          .select("order_id, mod_name, quantity, unit_price, pricing_type, pricing_value, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true });

  const safeLines = (lines ?? []) as OrderLineRow[];

  const linesByOrderId = new Map<string, OrderLineRow[]>();
  for (const l of safeLines) {
    const arr = linesByOrderId.get(l.order_id) ?? [];
    arr.push(l);
    linesByOrderId.set(l.order_id, arr);
  }

  // Vehicle labels
  const vehicleIds = Array.from(new Set(safeOrders.map((o) => o.vehicle_id)));
  const { data: vehicles, error: vehiclesErr } =
    vehicleIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer
          .from("vehicles")
          .select("id, manufacturer, model")
          .in("id", vehicleIds);

  const vehicleNameById = new Map<number, string>();
  (vehicles ?? []).forEach((v: any) => {
    const manufacturer = String(v?.manufacturer ?? "").trim();
    const model = String(v?.model ?? "").trim();
    const label = [manufacturer, model].filter(Boolean).join(" ") || `Vehicle #${v.id}`;
    vehicleNameById.set(Number(v.id), label);
  });

  // Staff labels
  const staffIds = Array.from(new Set(safeOrders.map((o) => o.staff_id)));
  const { data: staffRows, error: staffErr } =
    staffIds.length === 0
      ? { data: [], error: null as any }
      : await supabaseServer.from("staff").select("id, name, username").in("id", staffIds);

  const staffNameById = new Map<number, string>();
  (staffRows ?? []).forEach((s: any) => {
    const label =
      String(s?.name ?? "").trim() ||
      String(s?.username ?? "").trim() ||
      `Staff #${s.id}`;
    staffNameById.set(Number(s.id), label);
  });

  // Customer labels (best-effort)
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="text-slate-400 text-sm">
              Completed job history.
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="font-semibold">{session.staff.username}</p>
            <p className="text-xs text-slate-500">{roleLower(session.staff.role)}</p>
          </div>
        </div>

        {bannerWarnings.length > 0 && (
          <div className="mb-6 p-3 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-200 text-sm">
            <p className="font-semibold mb-1">Some lookups failed (showing best-effort data):</p>
            <ul className="list-disc pl-5 space-y-1">
              {bannerWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="font-semibold">Paid Jobs</p>
            <p className="text-sm text-slate-400">{safeOrders.length} shown</p>
          </div>

          {safeOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No paid jobs found.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {safeOrders.map((o) => {
                const vName = vehicleNameById.get(o.vehicle_id) ?? `Vehicle #${o.vehicle_id}`;
                const sName = staffNameById.get(o.staff_id) ?? `Staff #${o.staff_id}`;
                const cName =
                  o.customer_id == null
                    ? "Walk-in"
                    : customerNameById.get(o.customer_id) ?? `Customer #${o.customer_id}`;

                const orderLines = linesByOrderId.get(o.id) ?? [];

                return (
                  <div key={o.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-slate-50">{vName}</p>
                        <p className="text-sm text-slate-300">
                          Staff: <span className="font-semibold text-slate-100">{sName}</span>
                          {" · "}
                          Customer: <span className="font-semibold text-slate-100">{cName}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(o.created_at)} · Order #{o.id}
                        </p>

                        {o.note && (
                          <p className="text-sm text-slate-200 mt-2">
                            <span className="text-slate-400">Note:</span> {o.note}
                          </p>
                        )}
                      </div>

                      <div className="md:text-right">
                        <p className="text-sm text-slate-400">Subtotal: ${fmtMoney(o.subtotal)}</p>
                        <p className="text-sm text-slate-400">
                          Discount: -${fmtMoney(o.discount_amount)}
                        </p>
                        <p className="text-xl font-bold text-emerald-400">
                          Total: ${fmtMoney(o.total)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Status: {o.status}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-800 text-sm font-semibold text-slate-200">
                        Mods applied
                      </div>

                      {orderLines.length === 0 ? (
                        <div className="p-3 text-sm text-slate-400">No lines found.</div>
                      ) : (
                        <div className="divide-y divide-slate-800">
                          {orderLines.map((l, idx) => (
                            <div
                              key={`${l.order_id}:${idx}`}
                              className="px-3 py-2 text-sm flex justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <p className="text-slate-100 truncate">{l.mod_name}</p>
                                <p className="text-xs text-slate-500">
                                  Pricing: {l.pricing_type ?? "?"}{" "}
                                  {l.pricing_value != null ? `(${l.pricing_value})` : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-slate-200">
                                  {l.quantity} × ${fmtMoney(l.unit_price)}
                                </p>
                                <p className="text-slate-400 text-xs">
                                  Line: ${fmtMoney(Number(l.unit_price) * Number(l.quantity))}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Will eventually change this so jobs can be edited by Manager+
        </p>
      </div>
    </div>
  );
}
