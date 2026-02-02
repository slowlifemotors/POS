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

export type CartItem = {
  id: number; // item_id from `items` table (the mod item id)
  name: string; // display name: "<Vehicle> — <Mod>"
  price: number; // computed % of vehicle base_price
  quantity: number;

  // metadata (not used by API directly, but useful later)
  vehicle_id: number;
  mod_key: string;
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

type ModDef = {
  key: string;
  label: string;
  percent: number;
};

type ModWithItem = ModDef & {
  item_id: number | null; // from items table
};

const MODS: ModDef[] = [
  // Performance
  { key: "armour", label: "Armour", percent: 7 },
  { key: "brakes", label: "Brakes", percent: 6 },
  { key: "engine", label: "Engine", percent: 11 },
  { key: "suspension", label: "Suspension", percent: 5 },
  { key: "transmission", label: "Transmission", percent: 6 },
  { key: "turbo", label: "Turbo", percent: 7 },

  // Exterior
  { key: "exhaust", label: "Exhaust", percent: 1.56 },
  { key: "left_fender", label: "Left Fender", percent: 1.12 },
  { key: "cage", label: "Cage", percent: 1.12 },
  { key: "front_bumper", label: "Front Bumper", percent: 1.34 },
  { key: "grille", label: "Grille", percent: 1.72 },
  { key: "hood", label: "Hood", percent: 1.88 },
  { key: "rear_bumper", label: "Rear Bumper", percent: 1.55 },
  { key: "right_fender", label: "Right Fender", percent: 1.12 },
  { key: "roof", label: "Roof", percent: 1.58 },
  { key: "sideskirt", label: "Sideskirt", percent: 1.59 },
  { key: "spoilers", label: "Spoilers", percent: 1.65 },

  // Interior / misc
  { key: "aerial", label: "Aerial", percent: 1.12 },
  { key: "air_filter", label: "Air Filter", percent: 1.75 },
  { key: "arch_cover", label: "Arch Cover", percent: 1.19 },
  { key: "dashboard", label: "Dashboard", percent: 1.65 },
  { key: "door_speakers", label: "Door Speakers", percent: 1.58 },
  { key: "engine_block", label: "Engine Block", percent: 1.12 },
  { key: "fuel_tank", label: "Fuel Tank", percent: 1.13 },
  { key: "gear_lever", label: "Gear Lever", percent: 1.26 },
  { key: "hydraulic", label: "Hydraulic", percent: 1.12 },
  { key: "interior", label: "Interior", percent: 1.98 },
  { key: "quarter_deck", label: "Quarter Deck", percent: 1.19 },
  { key: "seats", label: "Seats", percent: 1.65 },
  { key: "speakers", label: "Speakers", percent: 1.98 },
  { key: "speedometer", label: "Speedometer", percent: 1.19 },
  { key: "steering_wheel", label: "Steering Wheel", percent: 1.19 },
  { key: "stickers", label: "Stickers", percent: 1.3 },
  { key: "struts", label: "Struts", percent: 1.51 },
  { key: "trim", label: "Trim", percent: 1.98 },
  { key: "trunk", label: "Trunk", percent: 1.58 },
  { key: "windows", label: "Windows", percent: 1.19 },
  { key: "wing", label: "Wing", percent: 1.05 },

  // Lights / paint
  { key: "horn", label: "Horn", percent: 0.65 },
  { key: "license_plate", label: "License Plate", percent: 1.1 },
  { key: "neon", label: "Neon", percent: 0.93 },
  { key: "pearlescent", label: "Pearlescent", percent: 0.75 },
  { key: "plate_holder", label: "Plate Holder", percent: 0.49 },
  { key: "primary", label: "Primary", percent: 1.02 },
  { key: "secondary", label: "Secondary", percent: 0.5 },
  { key: "vanity_plate", label: "Vanity Plate", percent: 0.41 },
  { key: "window_tint", label: "Window Tint", percent: 0.8 },
  { key: "xenon_headlights", label: "Xenon Headlights", percent: 1.92 },

  // Wheels
  { key: "allterrain", label: "Allterrain", percent: 1.19 },
  { key: "bennys", label: "Bennys", percent: 1.12 },
  { key: "bennys2", label: "Bennys2", percent: 1.12 },
  { key: "dragster", label: "Dragster", percent: 1.12 },
  { key: "highend", label: "Highend", percent: 1.12 },
  { key: "lowrider", label: "Lowrider", percent: 1.65 },
  { key: "motorcycle", label: "Motorcycle", percent: 1.26 },
  { key: "muscle", label: "Muscle", percent: 1.19 },
  { key: "sport", label: "Sport", percent: 4.65 },
  { key: "street", label: "Street", percent: 1.12 },
  { key: "suv", label: "Suv", percent: 1.19 },
  { key: "track", label: "Track", percent: 1.12 },
  { key: "tuning", label: "Tuning", percent: 1.12 },
  { key: "wheel_color", label: "Wheel Color", percent: 1.66 },
];

function roundToCents(n: number) {
  return Math.round(n * 100) / 100;
}

function vehicleDisplayName(v: Vehicle) {
  const manufacturer = (v.manufacturer ?? "").trim();
  const model = (v.model ?? "").trim();
  const name = [manufacturer, model].filter(Boolean).join(" ");
  return name || `Vehicle #${v.id}`;
}

export default function usePOS({ staffId }: UsePOSArgs) {
  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [mods, setMods] = useState<ModWithItem[]>(
    MODS.map((m) => ({ ...m, item_id: null }))
  );

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Customer modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);

  // -------------------------------------------------------
  // LOAD VEHICLES
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // LOAD MOD ITEMS (from items table)
  // -------------------------------------------------------
  const loadModItems = async () => {
    const modNames = MODS.map((m) => m.label);

    const { data, error } = await supabase
      .from("items")
      .select("id, name")
      .in("name", modNames);

    if (error) {
      console.error("Failed to load mod items:", error);
      setMods(MODS.map((m) => ({ ...m, item_id: null })));
      return;
    }

    const byName = new Map<string, number>();
    (data ?? []).forEach((row: any) => {
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return;
      byName.set(name, Number(row.id));
    });

    setMods(
      MODS.map((m) => ({
        ...m,
        item_id: byName.get(m.label) ?? null,
      }))
    );
  };

  // -------------------------------------------------------
  // LOAD TABS
  // -------------------------------------------------------
  const loadTabs = async () => {
    const res = await fetch("/api/tabs?active=true");
    const json = await res.json();
    if (Array.isArray(json.tabs)) setTabs(json.tabs as Tab[]);
    else setTabs([]);
  };

  useEffect(() => {
    loadVehicles();
    loadModItems();
    loadTabs();
  }, []);

  // -------------------------------------------------------
  // FILTER VEHICLES
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // SELECT VEHICLE
  // (clear cart because pricing depends on base_price)
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // ADD MOD TO CART
  // Fix: ensure item_id is narrowed to number before using it
  // -------------------------------------------------------
  const addModToCart = (modKey: string) => {
    if (!selectedVehicle) {
      alert("Select a vehicle first.");
      return;
    }

    const mod = mods.find((m) => m.key === modKey);
    if (!mod) return;

    const itemId = mod.item_id;
    if (itemId == null) {
      alert(
        `Missing mod item in items table for "${mod.label}". Create an item row with name "${mod.label}".`
      );
      return;
    }

    const vehicleName = vehicleDisplayName(selectedVehicle);
    const price = roundToCents((selectedVehicle.base_price * mod.percent) / 100);

    setCart((prev) => {
      const existing = prev.find(
        (c) => c.vehicle_id === selectedVehicle.id && c.mod_key === mod.key
      );

      if (existing) {
        return prev.map((c) =>
          c.vehicle_id === selectedVehicle.id && c.mod_key === mod.key
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }

      return [
        ...prev,
        {
          id: itemId,
          name: `${vehicleName} — ${mod.label}`,
          price,
          quantity: 1,
          vehicle_id: selectedVehicle.id,
          mod_key: mod.key,
        },
      ];
    });
  };

  // -------------------------------------------------------
  // CART MANAGEMENT
  // -------------------------------------------------------
  const updateQty = (id: number, amt: number) => {
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

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // -------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------
  const originalTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const discountPercent = discount ? discount.percent : 0;
  const discountAmount = (originalTotal * discountPercent) / 100;
  const finalTotal = roundToCents(originalTotal - discountAmount);

  // -------------------------------------------------------
  // BLACKLIST CHECK
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // CUSTOMER SELECTION
  // -------------------------------------------------------
  const handleSelectCustomer = (customer: Customer, disc: Discount | null) => {
    setSelectedCustomer(customer);
    setDiscount(disc);
    setShowCustomerModal(false);
  };

  // -------------------------------------------------------
  // REFRESH CUSTOMER
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // COMPLETE SALE
  // -------------------------------------------------------
  const completeSale = async (payment: string) => {
    if (isBlacklisted) {
      alert("This customer is currently blacklisted.");
      return;
    }

    if (!selectedVehicle) {
      alert("Select a vehicle before checkout.");
      return;
    }

    const method = (payment || paymentMethod || "").toString();

    // TAB logic (compatible with existing system)
    if (method.startsWith("tab:")) {
      const tabId = Number(method.replace("tab:", ""));
      const selectedTab = tabs.find((t) => t.id === tabId);

      if (!selectedTab) {
        alert("Selected tab not found.");
        return;
      }

      if (selectedTab.amount < finalTotal) {
        alert("Not enough funds on this tab.");
        return;
      }

      const update = await fetch("/api/tabs/update-balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab_id: selectedTab.id,
          new_amount: selectedTab.amount - finalTotal,
        }),
      });

      if (!update.ok) {
        alert("Failed to update tab balance.");
        return;
      }
    }

    // /api/sales expects { id, quantity, price }
    const cartPayload = cart.map((c) => ({
      id: c.id,
      quantity: c.quantity,
      price: c.price,

      // extra metadata (ignored by API today, useful later)
      name: c.name,
      vehicle_id: c.vehicle_id,
      mod_key: c.mod_key,
    }));

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: staffId,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        original_total: originalTotal,
        final_total: finalTotal,
        discount_id: discount ? discount.id : null,
        payment_method: method,
        cart: cartPayload,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(result.error || "Sale failed");
      return;
    }

    await loadVehicles();
    await loadTabs();

    setCart([]);
    setIsCheckoutOpen(false);
    setSelectedCustomer(null);
    setDiscount(null);
    setSelectedVehicle(null);

    alert("Sale Completed!");
  };

  return {
    // data
    vehicles,
    filteredVehicles,
    selectedVehicle,
    mods,

    tabs,
    cart,
    searchTerm,
    selectedCustomer,
    discount,
    originalTotal,
    discountAmount,
    finalTotal,
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
    completeSale,
  };
}
