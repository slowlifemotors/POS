// app/mods/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PricingType = "percentage" | "flat";

type Staff = {
  id: number;
  name?: string;
  username?: string;
  role?: string;
};

type ModRow = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
  is_menu: boolean;
  pricing_type: PricingType | null;
  pricing_value: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ModNode = ModRow & { children: ModNode[] };

function isAdminOrOwner(role: unknown) {
  const r = typeof role === "string" ? role.toLowerCase().trim() : "";
  return r === "admin" || r === "owner";
}

function buildTree(rows: ModRow[]) {
  const byId = new Map<string, ModNode>();

  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
  }

  const roots: ModNode[] = [];

  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (n: ModNode) => {
    n.children.sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortRecursive);
  };

  roots.sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.name.localeCompare(b.name);
  });
  roots.forEach(sortRecursive);

  const root = roots.find((r) => r.name === "Root" && r.parent_id === null) ?? null;
  return { root, roots };
}

function flattenTree(node: ModNode, depth: number, out: Array<{ node: ModNode; depth: number }>) {
  out.push({ node, depth });
  for (const child of node.children) flattenTree(child, depth + 1, out);
}

function formatPricing(mod: ModRow) {
  if (mod.is_menu) return "—";
  if (!mod.pricing_type || mod.pricing_value == null) return "Not set";
  if (mod.pricing_type === "percentage") return `${Number(mod.pricing_value).toFixed(2)}%`;
  return `$${Number(mod.pricing_value).toLocaleString()}`;
}

function parseNumberOrNull(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export default function ModsPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [mods, setMods] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  // Collapsible menus state (id -> open)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ModRow | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isMenu, setIsMenu] = useState(false);
  const [active, setActive] = useState(true);
  const [pricingType, setPricingType] = useState<PricingType | "">("");
  const [pricingValue, setPricingValue] = useState<string>("");

  // ----------------------------
  // Load session (client-side)
  // ----------------------------
  useEffect(() => {
    async function loadSession() {
      const res = await fetch(`${window.location.origin}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));

      if (!json?.staff) {
        router.push("/login");
        return;
      }

      const s = json.staff as Staff;
      setStaff(s);

      if (!isAdminOrOwner(s.role)) {
        setForbidden(true);
      }
    }

    loadSession();
  }, [router]);

  // ----------------------------
  // Load mods list (admin API)
  // ----------------------------
  const loadMods = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/mods", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Failed to load mods:", json);
      setMods([]);
      setLoading(false);
      return;
    }

    setMods(Array.isArray(json.mods) ? (json.mods as ModRow[]) : []);
    setLoading(false);
  };

  useEffect(() => {
    if (!staff) return;
    if (forbidden) return;
    loadMods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, forbidden]);

  // ----------------------------
  // Tree + filtering
  // ----------------------------
  const tree = useMemo(() => buildTree(mods), [mods]);

  const menuOptions = useMemo(() => {
    // parent choices: any menu node (including Root)
    const rows: ModRow[] = mods.filter((m) => m.is_menu);
    rows.sort((a, b) => {
      const ap = a.parent_id ?? "";
      const bp = b.parent_id ?? "";
      if (ap !== bp) return ap.localeCompare(bp);
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [mods]);

  const flatRows = useMemo(() => {
    const out: Array<{ node: ModNode; depth: number }> = [];

    const root = tree.root;
    if (root) {
      flattenTree(root, 0, out);
      return out;
    }

    // If root is missing, fall back to all roots
    for (const r of tree.roots) flattenTree(r, 0, out);
    return out;
  }, [tree]);

  const filteredFlatRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatRows;

    return flatRows.filter(({ node }) => {
      const hay = [
        node.name,
        node.is_menu ? "menu" : "mod",
        node.pricing_type ?? "",
        node.pricing_value == null ? "" : String(node.pricing_value),
        node.active ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [flatRows, search]);

  // ----------------------------
  // Collapsing logic
  // Hide rows whose ancestor menu is closed.
  // Root is always shown.
  // ----------------------------
  const visibleRows = useMemo(() => {
    // Build parent map for quick ancestor checks
    const parentById = new Map<string, string | null>();
    const isMenuById = new Map<string, boolean>();
    const nameById = new Map<string, string>();

    for (const m of mods) {
      parentById.set(m.id, m.parent_id ?? null);
      isMenuById.set(m.id, Boolean(m.is_menu));
      nameById.set(m.id, m.name);
    }

    const isHiddenByClosedAncestor = (id: string) => {
      let cur = parentById.get(id) ?? null;
      while (cur) {
        const isMenu = isMenuById.get(cur) ?? false;
        if (isMenu) {
          const open = openMap[cur];
          // default to open if undefined
          if (open === false) return true;
        }
        cur = parentById.get(cur) ?? null;
      }
      return false;
    };

    return filteredFlatRows.filter(({ node }) => {
      // Always show Root row if present
      if (node.name === "Root" && node.parent_id === null) return true;
      return !isHiddenByClosedAncestor(node.id);
    });
  }, [filteredFlatRows, mods, openMap]);

  // ----------------------------
  // Modal helpers
  // ----------------------------
  const openCreateModal = (parent?: ModRow | null) => {
    setEditing(null);

    setName("");
    setParentId(parent?.id ?? tree.root?.id ?? null);

    setDisplayOrder("0");
    setIsMenu(false);
    setActive(true);

    setPricingType("");
    setPricingValue("");

    setShowModal(true);
  };

  const openEditModal = (row: ModRow) => {
    setEditing(row);

    setName(row.name);
    setParentId(row.parent_id);
    setDisplayOrder(String(row.display_order ?? 0));
    setIsMenu(Boolean(row.is_menu));
    setActive(Boolean(row.active));

    setPricingType(row.pricing_type ?? "");
    setPricingValue(row.pricing_value == null ? "" : String(row.pricing_value));

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = async () => {
    const nm = name.trim();
    if (!nm) return alert("Name is required.");

    const orderNum = parseNumberOrNull(displayOrder);
    if (orderNum == null || orderNum < 0) return alert("Display order must be a number >= 0.");

    const payload: any = {
      name: nm,
      parent_id: parentId, // may be null
      display_order: Number(orderNum),
      is_menu: Boolean(isMenu),
      active: Boolean(active),
    };

    if (!isMenu) {
      if (pricingType === "" && pricingValue.trim() === "") {
        payload.pricing_type = null;
        payload.pricing_value = null;
      } else {
        if (pricingType !== "percentage" && pricingType !== "flat") {
          return alert("Pricing type must be percentage or flat (or blank to unset).");
        }
        const pv = parseNumberOrNull(pricingValue);
        if (pv == null || pv < 0) return alert("Pricing value must be a valid number >= 0.");
        if (pricingType === "percentage" && pv > 100) return alert("Percentage cannot exceed 100.");

        payload.pricing_type = pricingType;
        payload.pricing_value = pv;
      }
    } else {
      payload.pricing_type = null;
      payload.pricing_value = null;
    }

    const res = await fetch("/api/admin/mods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Create mod error:", json);
      alert(json.error || "Failed to create.");
      return;
    }

    closeModal();
    await loadMods();
  };

  const update = async () => {
    if (!editing) return;

    const nm = name.trim();
    if (!nm) return alert("Name is required.");

    const orderNum = parseNumberOrNull(displayOrder);
    if (orderNum == null || orderNum < 0) return alert("Display order must be a number >= 0.");

    const payload: any = {
      name: nm,
      parent_id: parentId,
      display_order: Number(orderNum),
      is_menu: Boolean(isMenu),
      active: Boolean(active),
    };

    if (!isMenu) {
      if (pricingType === "" && pricingValue.trim() === "") {
        payload.pricing_type = null;
        payload.pricing_value = null;
      } else {
        if (pricingType !== "percentage" && pricingType !== "flat") {
          return alert("Pricing type must be percentage or flat (or blank to unset).");
        }
        const pv = parseNumberOrNull(pricingValue);
        if (pv == null || pv < 0) return alert("Pricing value must be a valid number >= 0.");
        if (pricingType === "percentage" && pv > 100) return alert("Percentage cannot exceed 100.");

        payload.pricing_type = pricingType;
        payload.pricing_value = pv;
      }
    } else {
      payload.pricing_type = null;
      payload.pricing_value = null;
    }

    const res = await fetch(`/api/admin/mods/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Update mod error:", json);
      alert(json.error || "Failed to update.");
      return;
    }

    closeModal();
    await loadMods();
  };

  const deleteRow = async (row: ModRow) => {
    if (!confirm(`Delete "${row.name}"? This will also delete all children.`)) return;

    const res = await fetch(`/api/admin/mods/${row.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Delete mod error:", json);
      alert(json.error || "Failed to delete.");
      return;
    }

    await loadMods();
  };

  // ----------------------------
  // Reorder helpers (up/down within same parent)
  // Calls /api/admin/mods/reorder with normalized 0..n orders
  // ----------------------------
  const reorderWithinParent = async (parent_id: string | null, newSiblingOrder: string[]) => {
    const items = newSiblingOrder.map((id, idx) => ({ id, display_order: idx }));

    const res = await fetch("/api/admin/mods/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id, items }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Reorder error:", json);
      alert(json.error || "Failed to reorder.");
      return false;
    }

    return true;
  };

  const moveSibling = async (row: ModRow, direction: "up" | "down") => {
    const siblings = mods
      .filter((m) => (m.parent_id ?? null) === (row.parent_id ?? null))
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name);
      });

    const ids = siblings.map((s) => s.id);
    const idx = ids.indexOf(row.id);
    if (idx === -1) return;

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;

    const next = [...ids];
    const tmp = next[idx];
    next[idx] = next[swapWith];
    next[swapWith] = tmp;

    const ok = await reorderWithinParent(row.parent_id ?? null, next);
    if (ok) await loadMods();
  };

  // ----------------------------
  // UI
  // ----------------------------
  if (!staff) return null;

  if (forbidden) {
    return (
      <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
        <h2 className="text-3xl font-bold mb-2">Mods</h2>
        <p className="text-slate-300">
          You don’t have access to this page. (Admin/Owner only)
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-50 pt-24 px-8">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Mods</h2>
          <p className="text-slate-400 text-sm">
            Manage menus and mod pricing. Menus are collapsible in POS; leaf mods are added to cart.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadMods()}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg"
          >
            Refresh
          </button>

          <button
            onClick={() => openCreateModal(tree.root ? (tree.root as any as ModRow) : null)}
            className="bg-(--accent) hover:bg-(--accent-hover) px-4 py-2 rounded-lg"
          >
            + Add Mod / Menu
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search mods/menus..."
        className="w-full p-3 mb-6 bg-slate-900 border border-slate-700 rounded-lg"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-slate-900/90 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Pricing</th>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && visibleRows.map(({ node, depth }) => {
              const indent = Math.min(depth, 10);
              const paddingLeft = 12 + indent * 16;

              const isRoot = node.name === "Root" && node.parent_id === null;

              const isOpen = openMap[node.id] !== false; // default open
              const canCollapse = node.is_menu && node.children.length > 0;

              return (
                <tr key={node.id} className="border-b border-slate-800 hover:bg-slate-800">
                  <td className="p-3" style={{ paddingLeft }}>
                    <div className="flex items-center gap-2">
                      {canCollapse ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMap((prev) => ({ ...prev, [node.id]: !(prev[node.id] !== false) }))
                          }
                          className="text-slate-300 hover:text-white"
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="text-slate-700">•</span>
                      )}

                      <span className={node.is_menu ? "font-semibold text-slate-50" : "text-slate-100"}>
                        {node.name}
                      </span>

                      {node.is_menu && (
                        <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                          Menu
                        </span>
                      )}

                      {!node.active && (
                        <span className="text-xs text-red-300 bg-red-950/40 border border-red-900 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">{node.is_menu ? "Menu" : "Mod"}</td>

                  <td className="p-3">{formatPricing(node)}</td>

                  <td className="p-3">{node.display_order}</td>

                  <td className="p-3">{node.active ? "Yes" : "No"}</td>

                  <td className="p-3 text-right whitespace-nowrap">
                    {!isRoot && (
                      <>
                        <button
                          onClick={() => moveSibling(node, "up")}
                          className="text-slate-300 hover:text-white mr-3"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSibling(node, "down")}
                          className="text-slate-300 hover:text-white mr-4"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </>
                    )}

                    {node.is_menu && (
                      <button
                        onClick={() => openCreateModal(node)}
                        className="text-emerald-400 hover:text-emerald-300 mr-4"
                        title="Add child under this menu"
                      >
                        + Child
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(node)}
                      className="text-amber-400 hover:text-amber-300 mr-4"
                    >
                      Edit
                    </button>

                    {!isRoot && (
                      <button
                        onClick={() => deleteRow(node)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}

                    {isRoot && (
                      <span className="text-slate-500 text-xs">Root cannot be deleted</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {!loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                  No mods found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-1000">
          <div className="bg-slate-900 p-6 rounded-xl w-[560px] border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">
              {editing ? "Edit Mod / Menu" : "Add Mod / Menu"}
            </h2>

            <div className="space-y-4">
              <input
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Parent Menu</label>
                  <select
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                    value={parentId ?? ""}
                    onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
                  >
                    <option value="">(No parent)</option>
                    {menuOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Tip: choose the menu this node appears under (e.g. “Cosmetics”, “Body Parts”, “Wheels”).
                  </p>
                </div>

                <div className="w-[140px]">
                  <label className="block text-xs text-slate-400 mb-1">Display Order</label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    min={0}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isMenu}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsMenu(checked);
                      if (checked) {
                        setPricingType("");
                        setPricingValue("");
                      }
                    }}
                  />
                  This is a Menu (collapsible)
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>

              {!isMenu && (
                <div className="p-3 rounded-lg border border-slate-700 bg-slate-800">
                  <h3 className="font-semibold mb-2">Pricing</h3>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Pricing Type</label>
                      <select
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded"
                        value={pricingType}
                        onChange={(e) => setPricingType(e.target.value as any)}
                      >
                        <option value="">Not set</option>
                        <option value="percentage">Percentage (of vehicle base price)</option>
                        <option value="flat">Flat ($)</option>
                      </select>
                    </div>

                    <div className="w-[220px]">
                      <label className="block text-xs text-slate-400 mb-1">Pricing Value</label>
                      <input
                        type="number"
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded"
                        value={pricingValue}
                        onChange={(e) => setPricingValue(e.target.value)}
                        placeholder={pricingType === "percentage" ? "e.g. 7" : "e.g. 2000"}
                        min={0}
                        step="0.01"
                        disabled={pricingType === ""}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {pricingType === "percentage"
                          ? "Stored as a percentage (0–100)."
                          : pricingType === "flat"
                            ? "Stored as a fixed dollar amount."
                            : "Choose a pricing type to enable the value."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={editing ? update : save}
                className="px-4 py-2 bg-emerald-600 rounded font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
