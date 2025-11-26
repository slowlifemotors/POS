// app/api/categories/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------
   Create Supabase client INSIDE each handler
   (Fixes: "supabaseKey is required" at build time)
--------------------------------------------------------- */
function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,          // server URL
    process.env.SUPABASE_SERVICE_KEY!,  // service role key
    { auth: { persistSession: false } }
  );
}

/* ---------------------------------------------------------
   GET — all categories
--------------------------------------------------------- */
export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/* ---------------------------------------------------------
   POST — create category
--------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const supabase = supabaseServer();
    const body = await req.json();
    const { name, description, display_order, icon, color } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert([
        {
          name,
          description: description ?? null,
          display_order: display_order ?? null,
          icon: icon ?? null,
          color: color ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("POST /api/categories error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/categories exception:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ---------------------------------------------------------
   PUT — update category
--------------------------------------------------------- */
export async function PUT(req: Request) {
  try {
    const supabase = supabaseServer();
    const body = await req.json();
    const { id, name, description, display_order, icon, color } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      name,
      description: description ?? null,
      display_order: display_order ?? null,
      icon: icon ?? null,
      color: color ?? null,
    };

    const { data, error } = await supabase
      .from("categories")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("PUT /api/categories error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("PUT /api/categories exception:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ---------------------------------------------------------
   DELETE — delete category
--------------------------------------------------------- */
export async function DELETE(req: Request) {
  try {
    const supabase = supabaseServer();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE /api/categories error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/categories exception:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
