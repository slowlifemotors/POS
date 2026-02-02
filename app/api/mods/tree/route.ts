// app/api/mods/tree/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type ModRow = {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
  is_menu: boolean;
  pricing_type: "percentage" | "flat" | null;
  pricing_value: number | null;
  active: boolean;
};

type ModNode = ModRow & { children: ModNode[] };

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

export async function GET(req: Request) {
  // Staff must be authenticated to see POS mods
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;

  const session = await getSession();
  if (!session?.staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") !== "0"; // default true

  try {
    let query = supabaseServer
      .from("mods")
      .select("id, name, parent_id, display_order, is_menu, pricing_type, pricing_value, active")
      .order("parent_id", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) query = query.eq("active", true);

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/mods/tree error:", error);
      return NextResponse.json({ root: null, roots: [] }, { status: 200 });
    }

    const rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      parent_id: r.parent_id ? String(r.parent_id) : null,
      display_order: Number(r.display_order ?? 0),
      is_menu: Boolean(r.is_menu),
      pricing_type: (r.pricing_type ?? null) as ModRow["pricing_type"],
      pricing_value: r.pricing_value === null || r.pricing_value === undefined ? null : Number(r.pricing_value),
      active: Boolean(r.active),
    })) as ModRow[];

    const tree = buildTree(rows);

    return NextResponse.json(
      {
        root: tree.root,
        roots: tree.roots,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/mods/tree fatal:", err);
    return NextResponse.json({ root: null, roots: [] }, { status: 200 });
  }
}
