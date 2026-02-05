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
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  blacklist_start: string | null;
  blacklist_end: string | null;
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

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
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

const STANDALONE_MOD_NAMES = new Set(
  ["repair", "repair kit", "screwdriver"].map((s) => s.toLowerCase().trim())
);

const SERVICE_VEHICLE_ID = 1;

export default function usePOS({ staffId }: UsePOSArgs) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [modsRoot, setModsRoot] = useState<ModNode | null>(null);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");

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

  // ✅ NEW: plate entry (shown under customer, sent to order, shown in jobs)
  const [plate, setPlate] = useState("");

  // -------------------------
  // LOAD VEHICLES
  // -------------------------
  const loadVehicles = async () => {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, manufacturer, model, base_price, category, stock_class, maxed_class, note, active")
      .order("manufacturer", { ascending: true })
      .order("model", { ascending: true });

    if (error) {
      console.error("Failed to load vehicles:", error);
      setVehicles([]);
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
  };

  // -------------------------
  // LOAD MODS TREE
  // -------------------------
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

  // -------------------------
  // LOAD TABS
  // -------------------------
  const loadTabs = async () => {
    const res = await fetch("/api/tabs?active=true");
    const json = await res.json();
    if (Array.isArray(json.tabs)) setTabs(json.tabs as Tab[]);
    else setTabs([]);
  };

  useEffect(() => {
    loadVehicles();
    loadModsTree();
    loadTabs();
  }, []);

  // -------------------------
  // FILTER VEHICLES
  // -------------------------
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

  // -------------------------
  // SELECT VEHICLE
  // -------------------------
  const selectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    setCart([]);
    setIsCheckoutOpen(false);
  };

  const clearVehicle = () => {
    setSelectedVehicle(null);
    setCart([]);
    setIsCheckoutOpen(false);
  };

  // -------------------------
  // ADD MOD TO CART
  // -------------------------
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

            vehicle_id: SERVICE_VEHICLE_ID,
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

  // -------------------------
  // CART MANAGEMENT
  // -------------------------
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
  // TOTALS (staff = x0.75)
  // -------------------------
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const discountPercent = discount ? discount.percent : 0;
  const discountAmount = roundToCents((subtotal * discountPercent) / 100);

  const afterDiscount = roundToCents(subtotal - discountAmount);

  const staffMultiplier = selectedCustomerType === "staff" ? 0.75 : 1;
  const staffDiscountAmount = roundToCents(afterDiscount * (1 - staffMultiplier));

  const rawTotal = roundToCents(afterDiscount * staffMultiplier);
  const total = Math.ceil(rawTotal);

  // -------------------------
  // BLACKLIST CHECK
  // -------------------------
  useEffect(() => {
    if (!selectedCustomer) {
      setIsBlacklisted(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (
      selectedCustomer.is_blacklisted &&
      selectedCustomer.blacklist_start &&
      selectedCustomer.blacklist_end &&
      selectedCustomer.blacklist_start <= today &&
      today <= selectedCustomer.blacklist_end
    ) {
      setIsBlacklisted(true);
    } else {
      setIsBlacklisted(false);
    }
  }, [selectedCustomer]);

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

  // -------------------------
  // REFRESH CUSTOMER
  // -------------------------
  const refreshCustomer = async () => {
    if (!selectedCustomer) return;
    if (selectedCustomerType === "staff") return;

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
  // CREATE ORDER (checkout)
  // -------------------------
  const createOrder = async (note: string) => {
    if (isPaying) return;

    if (isBlacklisted) {
      alert("This customer is currently blacklisted.");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    if (!canCheckout) {
      alert("Select a vehicle to checkout vehicle mods.");
      return;
    }

    const orderVehicleId = selectedVehicle ? selectedVehicle.id : SERVICE_VEHICLE_ID;
    const orderVehicleBasePrice = selectedVehicle ? Number(selectedVehicle.base_price ?? 0) : 0;

    setIsPaying(true);

    try {
      const payload = {
        staff_id: staffId,
        vehicle_id: orderVehicleId,

        customer_id:
          selectedCustomerType === "staff"
            ? null
            : selectedCustomer
              ? selectedCustomer.id
              : null,

        discount_id: discount ? discount.id : null,
        customer_is_staff: selectedCustomerType === "staff",

        vehicle_base_price: orderVehicleBasePrice,

        // ✅ plate added (stored in orders.plate)
        plate: plate.trim() || null,

        subtotal: roundToCents(subtotal),
        discount_amount: roundToCents(discountAmount + staffDiscountAmount),
        total,

        note: note?.trim() || null,

        lines: cart.map((c) => ({
          vehicle_id: c.is_service_item ? SERVICE_VEHICLE_ID : c.vehicle_id,
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

      setCart([]);
      setIsCheckoutOpen(false);
      setSelectedCustomer(null);
      setSelectedCustomerType(null);
      setDiscount(null);
      setSelectedVehicle(null);

      // ✅ clear plate after successful sale
      setPlate("");

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
    originalTotal: subtotal,
    discountAmount,
    staffDiscountAmount,
    finalTotal: total,
    paymentMethod,
    isCheckoutOpen,
    showCustomerModal,
    showEditCustomerModal,
    isBlacklisted,
    isPaying,
    canCheckout,

    // ✅ plate API
    plate,
    setPlate,

    setSearchTerm,
    selectVehicle,
    clearVehicle,
    addModToCart,
    updateQty,
    removeItem,
    setPaymentMethod,
    setIsCheckoutOpen,
    setShowCustomerModal,
    setShowEditCustomerModal,
    handleSelectCustomer,
    refreshCustomer,

    createOrder,
    reloadModsTree: loadModsTree,
  };
}
