import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "png";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.staff) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if ((session.staff.permissions_level ?? 0) < 900)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const kind = (searchParams.get("kind") || "logo").toLowerCase(); // "logo" | "background"

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use PNG, JPG, WEBP, or SVG." },
        { status: 400 }
      );
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Same bucket for both logo + background (bucket name is "logo" in your project)
    const ext = extFromMime(file.type);
    const objectPath = kind === "background" ? `business/background.${ext}` : `business/logo.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage.from("logo").upload(objectPath, bytes, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("logo").getPublicUrl(objectPath);

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to create public URL" }, { status: 500 });
    }

    return NextResponse.json({ url: `${publicUrl}?v=${Date.now()}` });
  } catch (err: any) {
    console.error("Upload unexpected error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
