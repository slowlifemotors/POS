// app/pos/hooks/usePOS.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Vehicle = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  base_price: number;
  category: string | null;
  stock_class: string | null;
  maxed_class: string | null;
  note: string | null;
  active: boolean;
};

export type ModPricingType = "percentage" | "flat";

export type ModNode = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
  is_menu: boolean;
  pricing_type: ModPricingType | null;
  pricing_value: number | null;
  active: boolean;
  children: ModNode[];
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;

  vehicle_id: number;
  mod_id: string;
  mod_name: string;
  computed_price: number;
  pricing_type: ModPricingType;
  pricing_value: number;

  is_service_item?: boolean;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  discount_id: number | null;

  voucher_amount: number;

  membership_active: boolean;
  membership_start: string | null;
  membership_end: string | null;

  is_blacklisted: boolean;
  blacklist_reason: string | null;
  blacklist_start: string | null;
  blacklist_end: string | null;

  note?: string | null;
};

export type Discount = {
  id: number;
  name: string;
  percent: number;
};

export type Tab = {
  id: number;
  name: string;
  amount: number;
  active: boolean;
};

export type SelectedCustomerType = "customer" | "staff" | null;

type UsePOSArgs = {
  staffId: number;
  staffName?: string;
};

type DraftListItem = {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
};

type DraftPayload = {
  version: 1;

  staff_id: number;

  selected_vehicle_id: number | null;
  cart: CartItem[];

  selected_customer_type: SelectedCustomerType;
  selected_customer_id: number | null;
  staff_customer_id: number | null;

  plate: string;

  staff_customer_name: string | null;

  // ✅ NEW: stacked manual discount percent
  manual_discount_percent: number;
};

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

function clampPercent(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function vehicleDisplayName(v: Vehicle) {
  const manufacturer = (v.manufacturer ?? "").trim();
  const model = (v.model ?? "").trim();
  const name = [manufacturer, model].filter(Boolean).join(" ");
  return name || `Vehicle #${v.id}`;
}

function flattenMods(root: ModNode | null) {
  const map = new Map<string, ModNode>();
  if (!root) return map;

  const walk = (n: ModNode) => {
    map.set(n.id, n);
    (n.children ?? []).forEach(walk);
  };

  walk(root);
  return map;
}

function computeModPrice(mod: ModNode, vehicleBasePrice: number) {
  if (!mod.pricing_type || mod.pricing_value == null) return null;

  if (mod.pricing_type === "percentage") {
    const pct = Number(mod.pricing_value);
    const cost = roundToCents((vehicleBasePrice * pct) / 100);
    const sale = roundToCents(cost * 2);
    return sale;
  }

  return roundToCents(Number(mod.pricing_value));
}

function isNoVehiclePlaceholder(v: Vehicle) {
  const m = (v.manufacturer ?? "").trim().toLowerCase();
  const model = (v.model ?? "").trim().toLowerCase();
  const cat = (v.category ?? "").trim().toLowerCase();
  return m === "n/a" && model === "no vehicle" && Number(v.base_price ?? 0) === 0 && cat === "n/a";
}

// ✅ Allow these to sell without vehicle selected (flat-priced)
const STANDALONE_MOD_NAMES = new Set(
  ["repair", "repair kit", "screwdriver", "raffle ticket", "membership (month)"].map((s) =>
    s.toLowerCase().trim()
  )
);

const RAFFLE_MOD_NAMES = new Set(["raffle ticket"].map((s) => s.toLowerCase().trim()));

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function isMembershipActive(c: Customer | null) {
  if (!c) return false;
  if (!c.membership_active) return false;

  const s = c.membership_start;
  const e = c.membership_end;

  if (!s || !e) return true;

  const t = todayYMD();
  return s <= t && t <= e;
}

function isRaffleLineItem(item: CartItem) {
  return RAFFLE_MOD_NAMES.has(String(item.mod_name ?? "").toLowerCase().trim());
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function normalizeDraftPayload(raw: any): DraftPayload | null {
  try {
    if (raw == null) return null;

    let p: any = raw;

    if (typeof p === "string") {
      try {
        p = JSON.parse(p);
      } catch {
        return null;
      }
    }

    if (typeof p !== "object" || Array.isArray(p)) return null;

    if (p && typeof p === "object" && p.payload && typeof p.payload === "object") {
      const inner = p.payload;
      if (inner && (inner.cart || inner.selected_vehicle_id !== undefined || inner.version !== undefined)) {
        p = inner;
      }
    }

    const v = Number(p.version);
    if (v !== 1) return null;

    const normalized: DraftPayload = {
      version: 1,
      staff_id: Number(p.staff_id ?? 0),

      selected_vehicle_id: p.selected_vehicle_id == null ? null : Number(p.selected_vehicle_id),
      cart: Array.isArray(p.cart) ? (p.cart as CartItem[]) : [],

      selected_customer_type:
        p.selected_customer_type === "customer" || p.selected_customer_type === "staff"
          ? p.selected_customer_type
          : null,

      selected_customer_id: p.selected_customer_id == null ? null : Number(p.selected_customer_id),
      staff_customer_id: p.staff_customer_id == null ? null : Number(p.staff_customer_id),

      plate: String(p.plate ?? ""),
      staff_customer_name: p.staff_customer_name == null ? null : String(p.staff_customer_name),

      // ✅ NEW
      manual_discount_percent: clampPercent(Number(p.manual_discount_percent ?? 0)),
    };

    return normalized;
  } catch {
    return null;
  }
}

export default function usePOS({ staffId }: UsePOSArgs) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [serviceVehicle, setServiceVehicle] = useState<Vehicle | null>(null);

  const [modsRoot, setModsRoot] = useState<ModNode | null>(null);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState<SelectedCustomerType>(null);

  const [discount, setDiscount] = useState<Discount | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);

  const [isPaying, setIsPaying] = useState(false);

  const [plate, setPlate] = useState("");

  // ✅ NEW: Manual stacked discount (percent)
  // Allowed for now: 0 or 10 (15/20 UI disabled)
  const [manualDiscountPercent, setManualDiscountPercent] = useState<number>(0);

  // -------------------------
  // SAVED JOBS (DRAFTS)
  // -------------------------
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  const serviceVehicleId = serviceVehicle?.id ?? null;

  const loadVehicles = async () => {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, manufacturer, model, base_price, category, stock_class, maxed_class, note, active")
      .order("manufacturer", { ascending: true })
      .order("model", { ascending: true });

    if (error) {
      console.error("Failed to load vehicles:", error);
      setVehicles([]);
      setServiceVehicle(null);
      return;
    }

    const rows = (data ?? []).map((r: any) => ({
      id: Number(r.id),
      manufacturer: r.manufacturer ?? null,
      model: r.model ?? null,
      base_price: Number(r.base_price ?? 0),
      category: r.category ?? null,
      stock_class: r.stock_class ?? null,
      maxed_class: r.maxed_class ?? null,
      note: r.note ?? null,
      active: Boolean(r.active),
    })) as Vehicle[];

    setVehicles(rows);

    const placeholder = rows.find(isNoVehiclePlaceholder) ?? null;
    setServiceVehicle(placeholder);

    if (!placeholder) {
      console.warn(
        'No placeholder vehicle found (manufacturer="N/A", model="No Vehicle", base_price=0, category="N/A"). No-vehicle checkout may fail.'
      );
    }
  };

  const loadModsTree = async () => {
    try {
      const res = await fetch("/api/mods/tree", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const root = json?.root ?? null;

      if (!root) {
        setModsRoot(null);
        return;
      }

      setModsRoot(root as ModNode);
    } catch (err) {
      console.error("Failed to load mods tree:", err);
      setModsRoot(null);
    }
  };

  const loadTabs = async () => {
    const res = await fetch("/api/tabs?active=true");
    const json = await res.json().catch(() => ({}));
    if (Array.isArray(json.tabs)) setTabs(json.tabs as Tab[]);
    else setTabs([]);
  };

  useEffect(() => {
    loadVehicles();
    loadModsTree();
    loadTabs();
  }, []);

  const filteredVehicles = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const base = vehicles;

    if (!s) return base;

    return base.filter((v) => {
      const haystack = [
        vehicleDisplayName(v),
        v.category ?? "",
        v.stock_class ?? "",
        v.maxed_class ?? "",
        v.note ?? "",
        v.active ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [vehicles, searchTerm]);

  const modsById = useMemo(() => flattenMods(modsRoot), [modsRoot]);

  const selectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    setCart([]);
    setIsCheckoutOpen(false);
    setCurrentDraftId(null);
  };

  const clearVehicle = () => {
    setSelectedVehicle(null);
    setCart([]);
    setIsCheckoutOpen(false);
    setCurrentDraftId(null);
  };

  const isAllowedFlatOnInactive = (mod: ModNode) => {
    if (mod.pricing_type !== "flat") return false;
    const name = (mod.name ?? "").toLowerCase().trim();
    return name === "repair" || name === "repair kit" || name === "screwdriver" || name === "raffle ticket";
  };

  const isInCosmeticsPath = (modId: string) => {
    let cur = modsById.get(modId);
    let guard = 0;

    while (cur && guard++ < 50) {
      const parentId = cur.parent_id;
      if (!parentId) break;

      const parent = modsById.get(parentId);
      if (!parent) break;

      const parentName = (parent.name ?? "").toLowerCase().trim();
      if (parent.is_menu && parentName === "cosmetics") return true;

      cur = parent;
    }

    return false;
  };

  const addModToCart = (modId: string) => {
    const mod = modsById.get(modId);
    if (!mod) return;
    if (mod.is_menu) return;

    const pt = mod.pricing_type;
    const pv = mod.pricing_value;

    if (!pt || pv == null) {
      alert(`"${mod.name}" has no pricing set. Configure it in /mods.`);
      return;
    }

    const selectedInactive = Boolean(selectedVehicle && selectedVehicle.active === false);
    if (selectedInactive) {
      const cosmeticsOk = isInCosmeticsPath(mod.id);
      const flatWhitelistOk = isAllowedFlatOnInactive(mod);

      if (!cosmeticsOk && !flatWhitelistOk) {
        alert("Inactive vehicles can only receive Cosmetics, Repair, Repair Kit, Screwdriver, or Raffle Ticket.");
        return;
      }
    }

    const modNameKey = String(mod.name ?? "").toLowerCase().trim();
    const isStandaloneAllowed = STANDALONE_MOD_NAMES.has(modNameKey);

    if (!selectedVehicle) {
      if (!isStandaloneAllowed) {
        alert("Select a vehicle first.");
        return;
      }

      if (pt !== "flat") {
        alert(`"${mod.name}" must be flat-priced to sell without a vehicle.`);
        return;
      }

      if (!serviceVehicleId) {
        alert('Missing "No Vehicle" placeholder row in vehicles table. Cannot sell without a vehicle.');
        return;
      }

      const computedSale = roundToCents(Number(pv));
      const lineId = `service:${mod.id}`;

      setCart((prev) => {
        const existing = prev.find((c) => c.id === lineId);
        if (existing) {
          return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
        }

        return [
          ...prev,
          {
            id: lineId,
            name: `${mod.name}`,
            price: computedSale,
            computed_price: computedSale,
            quantity: 1,

            vehicle_id: serviceVehicleId,
            mod_id: mod.id,
            mod_name: mod.name,
            pricing_type: pt,
            pricing_value: Number(pv),

            is_service_item: true,
          },
        ];
      });

      return;
    }

    const computedSale = computeModPrice(mod, selectedVehicle.base_price);
    if (computedSale == null) {
      alert(`"${mod.name}" has invalid pricing. Configure it in /mods.`);
      return;
    }

    const lineId = `${selectedVehicle.id}:${mod.id}`;
    const vName = vehicleDisplayName(selectedVehicle);

    setCart((prev) => {
      const existing = prev.find((c) => c.id === lineId);

      if (existing) {
        return prev.map((c) => (c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }

      return [
        ...prev,
        {
          id: lineId,
          name: `${vName} — ${mod.name}`,
          price: computedSale,
          computed_price: computedSale,
          quantity: 1,

          vehicle_id: selectedVehicle.id,
          mod_id: mod.id,
          mod_name: mod.name,
          pricing_type: pt,
          pricing_value: Number(pv),

          is_service_item: false,
        },
      ];
    });
  };

  const updateQty = (id: string, amt: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amt) } : item))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // -------------------------
  // TOTALS (NO DISCOUNTS ON RAFFLE)
  // -------------------------
  const cartHasRaffle = cart.some(isRaffleLineItem);

  const raffleSubtotal = cart
    .filter(isRaffleLineItem)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const nonRaffleSubtotal = cart
    .filter((c) => !isRaffleLineItem(c))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Base discount rules (unchanged):
  // - Membership OR discount (whichever is higher)
  // - Only for real customers (not staff)
  // - Not allowed when cart has raffle
  const membershipPct =
    !cartHasRaffle && selectedCustomerType === "customer" && isMembershipActive(selectedCustomer) ? 10 : 0;

  const discountPercent = !cartHasRaffle && discount ? Number(discount.percent ?? 0) : 0;

  const baseDiscountPercent = selectedCustomerType === "staff" ? 0 : Math.max(discountPercent, membershipPct);

  // ✅ Manual discount stacks on top (also blocked for raffle)
  const manualPct = !cartHasRaffle ? clampPercent(manualDiscountPercent) : 0;

  const effectiveDiscountPercent = clampPercent(baseDiscountPercent + manualPct);

  const nonRaffleDiscountAmount = roundToCents((nonRaffleSubtotal * effectiveDiscountPercent) / 100);
  const nonRaffleAfterDiscount = roundToCents(nonRaffleSubtotal - nonRaffleDiscountAmount);

  // Staff pricing (25% off) applies ONLY to non-raffle
  const staffMultiplier = selectedCustomerType === "staff" ? 0.75 : 1;
  const nonRaffleStaffDiscountAmount = roundToCents(nonRaffleAfterDiscount * (1 - staffMultiplier));
  const nonRaffleRawTotal = roundToCents(nonRaffleAfterDiscount * staffMultiplier);
  const nonRaffleTotal = Math.ceil(nonRaffleRawTotal);

  // Raffle portion is ALWAYS full price
  const raffleTotal = Math.ceil(roundToCents(raffleSubtotal));

  // Combined
  const subtotal = roundToCents(nonRaffleSubtotal + raffleSubtotal);
  const discountAmount = roundToCents(nonRaffleDiscountAmount); // raffle never contributes
  const staffDiscountAmount = roundToCents(nonRaffleStaffDiscountAmount); // raffle never contributes

  const total = Math.ceil(roundToCents(nonRaffleTotal + raffleTotal));

  // Used for UI display in Cart
  const hasAnyDiscountLine = effectiveDiscountPercent > 0 && nonRaffleSubtotal > 0;
  const discountLineTextParts: string[] = [];
  if (baseDiscountPercent > 0) discountLineTextParts.push(`${baseDiscountPercent}%`);
  if (manualPct > 0) discountLineTextParts.push(`+${manualPct}%`);
  const discountLineLabel = discountLineTextParts.length ? `${discountLineTextParts.join(" ")} (stacked)` : null;

  // -------------------------
  // BLACKLIST CHECK
  // -------------------------
  useEffect(() => {
    if (!selectedCustomer) {
      setIsBlacklisted(false);
      return;
    }

    if (selectedCustomerType !== "customer") {
      setIsBlacklisted(false);
      return;
    }

    if (!selectedCustomer.is_blacklisted) {
      setIsBlacklisted(false);
      return;
    }

    const start = selectedCustomer.blacklist_start;
    const end = selectedCustomer.blacklist_end;

    if (!start || !end) {
      setIsBlacklisted(true);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    setIsBlacklisted(start <= today && today <= end);
  }, [selectedCustomer, selectedCustomerType]);

  // Only apply x2 for real customers (not staff sales)
  const blacklistMultiplier = isBlacklisted && selectedCustomerType === "customer" ? 2 : 1;

  const displaySubtotal = roundToCents(subtotal * blacklistMultiplier);
  const displayDiscountAmount = roundToCents(discountAmount * blacklistMultiplier);
  const displayStaffDiscountAmount = roundToCents(staffDiscountAmount * blacklistMultiplier);

  const displayTotal = Math.ceil(total * blacklistMultiplier);

  // -------------------------
  // CUSTOMER SELECTION
  // -------------------------
  const handleSelectCustomer = (
    customer: Customer,
    disc: Discount | null,
    customerType: SelectedCustomerType = "customer"
  ) => {
    setSelectedCustomer(customer);
    setSelectedCustomerType(customerType);
    setDiscount(disc);
    setShowCustomerModal(false);
  };

  const refreshCustomer = async () => {
    if (!selectedCustomer) return;
    if (selectedCustomerType !== "customer") return;

    const res = await fetch(`/api/customers?id=${selectedCustomer.id}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    if (json.customer) {
      setSelectedCustomer(json.customer);

      if (json.customer.discount_id) {
        const dres = await fetch(`/api/discounts?id=${json.customer.discount_id}`, { cache: "no-store" });
        const djson = await dres.json().catch(() => ({}));
        setDiscount(djson.discount || null);
      } else {
        setDiscount(null);
      }
    }
  };

  const cartHasVehicleItems = cart.some((c) => !c.is_service_item);
  const canCheckout = cart.length > 0 && (!cartHasVehicleItems || (cartHasVehicleItems && selectedVehicle != null));

  // -------------------------
  // SAVED JOBS HELPERS
  // -------------------------
  const buildDraftPayload = (): DraftPayload => {
    const staffCustomerId =
      selectedCustomerType === "staff" && selectedCustomer ? Math.abs(Number(selectedCustomer.id)) : null;

    return {
      version: 1,
      staff_id: staffId,
      selected_vehicle_id: selectedVehicle ? selectedVehicle.id : null,
      cart,
      selected_customer_type: selectedCustomerType,
      selected_customer_id: selectedCustomerType === "customer" && selectedCustomer ? selectedCustomer.id : null,
      staff_customer_id: selectedCustomerType === "staff" ? staffCustomerId : null,
      plate: plate ?? "",
      staff_customer_name:
        selectedCustomerType === "staff" && selectedCustomer ? String(selectedCustomer.name ?? "") : null,

      // ✅ NEW
      manual_discount_percent: clampPercent(manualDiscountPercent),
    };
  };

  const loadSavedJobs = async () => {
    setDraftsLoading(true);
    setDraftsError(null);
    try {
      const res = await fetch("/api/pos/jobs", { cache: "no-store" });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to load saved jobs.");
      setDrafts(Array.isArray(json.jobs) ? (json.jobs as DraftListItem[]) : []);
    } catch (e: any) {
      setDraftsError(e?.message ?? "Failed to load saved jobs.");
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const saveJob = async (title?: string) => {
    if (cart.length === 0) {
      alert("Cart is empty — nothing to save.");
      return null;
    }

    const payload = buildDraftPayload();

    const res = await fetch("/api/pos/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        id: currentDraftId,
        title: (title ?? "").trim() || null,
        payload,
      }),
    });

    const json = await safeJson(res);
    if (!res.ok) {
      alert(json?.error || "Failed to save job.");
      return null;
    }

    const id = String(json?.id ?? "");
    if (id) setCurrentDraftId(id);

    loadSavedJobs();

    return id || null;
  };

  const deleteJob = async (id: string) => {
    const ok = confirm("Delete this saved job?");
    if (!ok) return;

    const res = await fetch(`/api/pos/jobs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });

    const json = await safeJson(res);
    if (!res.ok) {
      alert(json?.error || "Failed to delete saved job.");
      return;
    }

    if (currentDraftId === id) setCurrentDraftId(null);

    loadSavedJobs();
  };

  const applyDraftToState = async (draft: DraftPayload) => {
    const vId = Number(draft.selected_vehicle_id ?? 0);
    const v = vId ? vehicles.find((x) => x.id === vId) ?? null : null;
    setSelectedVehicle(v);

    setCart(Array.isArray(draft.cart) ? (draft.cart as CartItem[]) : []);
    setPlate(String(draft.plate ?? ""));

    // ✅ restore manual discount
    setManualDiscountPercent(clampPercent(Number(draft.manual_discount_percent ?? 0)));

    if (draft.selected_customer_type === "customer" && draft.selected_customer_id) {
      const cid = Number(draft.selected_customer_id);

      const res = await fetch(`/api/customers?id=${cid}`, { cache: "no-store" });
      const json = await safeJson(res);
      if (res.ok && json?.customer) {
        const customer = json.customer as Customer;
        setSelectedCustomer(customer);
        setSelectedCustomerType("customer");

        if (customer.discount_id) {
          const dres = await fetch(`/api/discounts?id=${customer.discount_id}`, { cache: "no-store" });
          const djson = await safeJson(dres);
          setDiscount(dres.ok ? (djson?.discount as Discount) ?? null : null);
        } else {
          setDiscount(null);
        }
      } else {
        setSelectedCustomer(null);
        setSelectedCustomerType(null);
        setDiscount(null);
      }
      return;
    }

    if (draft.selected_customer_type === "staff" && draft.staff_customer_id) {
      const staffCustomerId = Number(draft.staff_customer_id);

      const pseudoCustomer: Customer = {
        id: -Math.abs(staffCustomerId),
        name: String(draft.staff_customer_name ?? `Staff #${staffCustomerId}`),
        phone: null,
        discount_id: null,

        voucher_amount: 0,

        membership_active: false,
        membership_start: null,
        membership_end: null,

        is_blacklisted: false,
        blacklist_reason: null,
        blacklist_start: null,
        blacklist_end: null,
      };

      setSelectedCustomer(pseudoCustomer);
      setSelectedCustomerType("staff");
      setDiscount(null);
      return;
    }

    setSelectedCustomer(null);
    setSelectedCustomerType(null);
    setDiscount(null);
  };

  const resumeJob = async (id: string) => {
    const res = await fetch(`/api/pos/jobs?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = await safeJson(res);
    if (!res.ok) {
      alert(json?.error || "Failed to load saved job.");
      return;
    }

    const normalized = normalizeDraftPayload(json?.payload);
    if (!normalized) {
      console.warn("Incompatible saved job payload:", json?.payload);
      alert("Saved job payload is missing or incompatible.");
      return;
    }

    setCurrentDraftId(String(id));
    setIsCheckoutOpen(false);

    await applyDraftToState(normalized);
  };

  const startNewJob = () => {
    setCart([]);
    setIsCheckoutOpen(false);

    setSelectedCustomer(null);
    setSelectedCustomerType(null);
    setDiscount(null);

    setPlate("");
    setCurrentDraftId(null);

    setSelectedVehicle(null);

    // ✅ reset manual discount
    setManualDiscountPercent(0);
  };

  const clearJobState = () => {
    setCart([]);
    setIsCheckoutOpen(false);
    setSelectedCustomer(null);
    setSelectedCustomerType(null);
    setDiscount(null);
    setSelectedVehicle(null);
    setPlate("");
    setCurrentDraftId(null);

    // ✅ reset manual discount
    setManualDiscountPercent(0);
  };

  const createOrder = async (
    note: string,
    payment: { method: "card" | "voucher" | "split"; voucher_used: number; card_charge: number }
  ) => {
    if (isPaying) return;

    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    if (!canCheckout) {
      alert("Select a vehicle to checkout vehicle mods.");
      return;
    }

    if (!selectedVehicle && !serviceVehicleId) {
      alert('Missing "No Vehicle" placeholder row in vehicles table. Cannot checkout without a vehicle.');
      return;
    }

    const orderVehicleId = selectedVehicle ? selectedVehicle.id : serviceVehicleId!;
    const orderVehicleBasePrice = selectedVehicle ? Number(selectedVehicle.base_price ?? 0) : 0;

    const staffCustomerId =
      selectedCustomerType === "staff" && selectedCustomer ? Math.abs(Number(selectedCustomer.id)) : null;

    // Voucher rules:
    // - Only real customers can use voucher
    // - Voucher cannot be used on raffle ticket sales (server enforces too)
    const voucherAllowed = selectedCustomerType === "customer" && selectedCustomer != null && !cartHasRaffle;
    const voucherBalance = voucherAllowed ? Number(selectedCustomer!.voucher_amount ?? 0) : 0;

    let voucherUsed = 0;
    if (voucherAllowed && (payment.method === "voucher" || payment.method === "split")) {
      voucherUsed = roundToCents(Math.min(Math.max(0, voucherBalance), Math.max(0, displayTotal)));
    }

    const cardCharge = roundToCents(Math.max(0, displayTotal - voucherUsed));
    const finalMethod = voucherUsed > 0 && cardCharge > 0 ? "split" : voucherUsed > 0 ? "voucher" : "card";

    const payNote = `[PAYMENT: ${finalMethod.toUpperCase()} | voucher_used=$${voucherUsed.toFixed(
      2
    )} | card_charge=$${cardCharge.toFixed(2)}]`;

    const finalNote = (blacklistMultiplier === 2 ? "[BLACKLISTED x2] " : "") + (note?.trim() || "");

    setIsPaying(true);

    try {
      const payload = {
        staff_id: staffId,
        vehicle_id: orderVehicleId,

        customer_id: selectedCustomerType === "staff" ? null : selectedCustomer ? selectedCustomer.id : null,

        staff_customer_id: staffCustomerId,
        customer_is_staff: selectedCustomerType === "staff",

        // ✅ No discounts on raffle ticket sales
        discount_id: cartHasRaffle ? null : discount ? discount.id : null,

        // ✅ NEW: send manual discount too (backend should apply this if it recomputes totals)
        manual_discount_percent: !cartHasRaffle ? clampPercent(manualDiscountPercent) : 0,

        vehicle_base_price: orderVehicleBasePrice,

        plate: plate.trim() || null,
        note: `${payNote} ${finalNote}`.trim() || null,

        // ✅ No voucher on raffle sales
        voucher_used: voucherAllowed ? voucherUsed : 0,

        lines: cart.map((c) => ({
          vehicle_id: orderVehicleId,
          mod_id: c.mod_id,
          mod_name: c.mod_name,
          quantity: c.quantity,
          computed_price: c.computed_price,
          pricing_type: c.pricing_type,
          pricing_value: c.pricing_value,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.error || "Failed to create order.");
        return;
      }

      if (currentDraftId) {
        fetch(`/api/pos/jobs?id=${encodeURIComponent(currentDraftId)}`, {
          method: "DELETE",
          cache: "no-store",
        }).catch(() => {});
      }

      clearJobState();

      alert(`Sale completed! Order ID: ${json.order_id}`);
    } finally {
      setIsPaying(false);
    }
  };

  return {
    vehicles,
    filteredVehicles,
    selectedVehicle,
    modsRoot,
    tabs,
    cart,
    searchTerm,
    selectedCustomer,
    selectedCustomerType,
    discount,

    // Keep names consistent with your UI:
    originalTotal: displaySubtotal,
    discountAmount: displayDiscountAmount,
    staffDiscountAmount: displayStaffDiscountAmount,
    finalTotal: displayTotal,

    // ✅ Discount UI helpers
    manualDiscountPercent,
    setManualDiscountPercent,
    hasAnyDiscountLine,
    discountLineLabel,

    isCheckoutOpen,
    showCustomerModal,
    showEditCustomerModal,
    isBlacklisted,
    isPaying,
    canCheckout,

    plate,
    setPlate,

    drafts,
    draftsLoading,
    draftsError,
    currentDraftId,

    loadSavedJobs,
    saveJob,
    resumeJob,
    deleteJob,

    startNewJob,

    setSearchTerm,
    selectVehicle,
    clearVehicle,
    addModToCart,
    updateQty,
    removeItem,
    setIsCheckoutOpen,
    setShowCustomerModal,
    setShowEditCustomerModal,

    handleSelectCustomer,
    refreshCustomer,

    createOrder,
    reloadModsTree: loadModsTree,
  };
}