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
  id: string; // stable cart line id (vehicle_id:mod_id)
  name: string; // display name: "<Vehicle> — <Mod>"
  price: number; // computed unit price
  quantity: number;

  // REQUIRED metadata
  vehicle_id: number;
  mod_id: string;
  mod_name: string;
  computed_price: number; // same as price (explicitly stored)

  pricing_type: ModPricingType;
  pricing_value: number;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
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
    return roundToCents((vehicleBasePrice * pct) / 100);
  }

  return roundToCents(Number(mod.pricing_value));
}

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
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);

  // -------------------------
  // LOAD VEHICLES
  // -------------------------
  const loadVehicles = async () => {
    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "id, manufacturer, model, base_price, category, stock_class, maxed_class, note, active"
      )
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
  // LOAD TABS (kept for now; payment later)
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
    const base = vehicles.filter((v) => v.active);

    if (!s) return base;

    return base.filter((v) => {
      const haystack = [
        vehicleDisplayName(v),
        v.category ?? "",
        v.stock_class ?? "",
        v.maxed_class ?? "",
        v.note ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [vehicles, searchTerm]);

  const modsById = useMemo(() => flattenMods(modsRoot), [modsRoot]);

  // -------------------------
  // SELECT VEHICLE (clears cart)
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
    if (!selectedVehicle) {
      alert("Select a vehicle first.");
      return;
    }

    const mod = modsById.get(modId);
    if (!mod) return;
    if (mod.is_menu) return;

    const pt = mod.pricing_type;
    const pv = mod.pricing_value;

    if (!pt || pv == null) {
      alert(`"${mod.name}" has no pricing set. Configure it in /mods.`);
      return;
    }

    const computed = computeModPrice(mod, selectedVehicle.base_price);
    if (computed == null) {
      alert(`"${mod.name}" has invalid pricing. Configure it in /mods.`);
      return;
    }

    const lineId = `${selectedVehicle.id}:${mod.id}`;
    const vName = vehicleDisplayName(selectedVehicle);

    setCart((prev) => {
      const existing = prev.find((c) => c.id === lineId);

      if (existing) {
        return prev.map((c) =>
          c.id === lineId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }

      return [
        ...prev,
        {
          id: lineId,
          name: `${vName} — ${mod.name}`,
          price: computed,
          computed_price: computed,
          quantity: 1,

          vehicle_id: selectedVehicle.id,
          mod_id: mod.id,
          mod_name: mod.name,
          pricing_type: pt,
          pricing_value: Number(pv),
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
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + amt) }
            : item
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // -------------------------
  // TOTALS (still computed; stored on order)
  // -------------------------
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountPercent = discount ? discount.percent : 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = roundToCents(subtotal - discountAmount);

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
  const handleSelectCustomer = (customer: Customer, disc: Discount | null) => {
    setSelectedCustomer(customer);
    setDiscount(disc);
    setShowCustomerModal(false);
  };

  // -------------------------
  // REFRESH CUSTOMER
  // -------------------------
  const refreshCustomer = async () => {
    if (!selectedCustomer) return;

    const res = await fetch(`/api/customers?id=${selectedCustomer.id}`);
    const json = await res.json();

    if (json.customer) {
      setSelectedCustomer(json.customer);

      if (json.customer.discount_id) {
        const dres = await fetch(`/api/discounts?id=${json.customer.discount_id}`);
        const djson = await dres.json();
        setDiscount(djson.discount || null);
      } else {
        setDiscount(null);
      }
    }
  };

  // -------------------------
  // CREATE ORDER (new checkout)
  // -------------------------
  const createOrder = async (note: string) => {
    if (isBlacklisted) {
      alert("This customer is currently blacklisted.");
      return;
    }

    if (!selectedVehicle) {
      alert("Select a vehicle first.");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    const payload = {
      staff_id: staffId,
      vehicle_id: selectedVehicle.id,
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      discount_id: discount ? discount.id : null,

      vehicle_base_price: Number(selectedVehicle.base_price ?? 0),

      subtotal: roundToCents(subtotal),
      discount_amount: roundToCents(discountAmount),
      total: roundToCents(total),

      note: note?.trim() || null,

      lines: cart.map((c) => ({
        vehicle_id: c.vehicle_id,
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

    // Reset POS state for next job
    setCart([]);
    setIsCheckoutOpen(false);
    setSelectedCustomer(null);
    setDiscount(null);
    setSelectedVehicle(null);

    alert(`Job created! Order ID: ${json.order_id}`);
  };

  return {
    // data
    vehicles,
    filteredVehicles,
    selectedVehicle,
    modsRoot,
    tabs,
    cart,
    searchTerm,
    selectedCustomer,
    discount,
    originalTotal: subtotal,
    discountAmount,
    finalTotal: total,
    paymentMethod,
    isCheckoutOpen,
    showCustomerModal,
    showEditCustomerModal,
    isBlacklisted,

    // actions
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

    // new
    createOrder,
    reloadModsTree: loadModsTree,
  };
}
