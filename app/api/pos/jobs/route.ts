// app/api/pos/jobs/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeString(x: unknown) {
  return typeof x === "string" ? x : "";
}

function safeTrimmedStringOrNull(x: unknown) {
  const s = safeString(x).trim();
  return s.length ? s : null;
}

function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function payloadVersion(payload: unknown): number | null {
  if (!isObject(payload)) return null;
  const v = payload.version;
  return typeof v === "number" ? v : null;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.staff) return jsonErr("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const id = safeString(searchParams.get("id"));

  // -------------------------
  // GET ONE (payload)
  // -------------------------
  if (id) {
    const { data, error } = await supabaseServer
      .from("pos_jobs_drafts")
      .select("id, staff_id, title, payload, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return jsonErr(error.message || "Failed to load saved job.", 500);
    if (!data) return jsonErr("Saved job not found.", 404);

    // Staff can only access their own saved jobs (unless owner/admin/manager)
    // If you want managers to see all saved jobs, remove this guard.
    const isManager =
      ["owner", "admin", "manager"].includes(String(session.staff.role ?? "").toLowerCase().trim());

    if (!isManager && Number(data.staff_id) !== Number(session.staff.id)) {
      return jsonErr("Forbidden", 403);
    }

    return NextResponse.json({
      id: data.id,
      title: data.title ?? null,
      payload: data.payload ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  }

  // -------------------------
  // GET LIST (for modal)
  // -------------------------
  const isManager =
    ["owner", "admin", "manager"].includes(String(session.staff.role ?? "").toLowerCase().trim());

  const q = supabaseServer
    .from("pos_jobs_drafts")
    .select("id, staff_id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  // If NOT manager, only show own drafts
  const query = isManager ? q : q.eq("staff_id", session.staff.id);

  const { data, error } = await query;

  if (error) return jsonErr(error.message || "Failed to load saved jobs.", 500);

  const jobs = (data ?? []).map((r: any) => ({
    id: String(r.id),
    title: r.title ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    staff_id: Number(r.staff_id),
  }));

  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.staff) return jsonErr("Unauthorized", 401);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  const id = safeTrimmedStringOrNull(body?.id);
  const title = safeTrimmedStringOrNull(body?.title);
  const payload = body?.payload;

  if (!payload || !isObject(payload)) {
    return jsonErr("Missing payload.", 400);
  }

  // Enforce your payload version contract.
  // This prevents "Saved job payload is missing or incompatible." later.
  const v = payloadVersion(payload);
  if (v !== 1) {
    return jsonErr('Payload "version" must be 1.', 400);
  }

  const staffId = Number(session.staff.id);

  // -------------------------
  // UPDATE existing
  // -------------------------
  if (id) {
    // Ensure row exists and belongs to staff (unless manager)
    const isManager =
      ["owner", "admin", "manager"].includes(String(session.staff.role ?? "").toLowerCase().trim());

    const { data: existing, error: exErr } = await supabaseServer
      .from("pos_jobs_drafts")
      .select("id, staff_id")
      .eq("id", id)
      .maybeSingle();

    if (exErr) return jsonErr(exErr.message || "Failed to load draft.", 500);
    if (!existing) return jsonErr("Saved job not found.", 404);

    if (!isManager && Number(existing.staff_id) !== staffId) {
      return jsonErr("Forbidden", 403);
    }

    const { error } = await supabaseServer
      .from("pos_jobs_drafts")
      .update({
        title,
        payload,
        // updated_at handled by trigger; leaving it out is fine
      })
      .eq("id", id);

    if (error) return jsonErr(error.message || "Failed to save job.", 500);

    return NextResponse.json({ id });
  }

  // -------------------------
  // INSERT new
  // -------------------------
  const { data, error } = await supabaseServer
    .from("pos_jobs_drafts")
    .insert({
      staff_id: staffId,
      title,
      payload,
      // id/created_at/updated_at are defaults in DB now
    })
    .select("id")
    .maybeSingle();

  if (error) return jsonErr(error.message || "Failed to save job.", 500);

  return NextResponse.json({ id: data?.id ?? null });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.staff) return jsonErr("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const id = safeString(searchParams.get("id")).trim();
  if (!id) return jsonErr("Missing id", 400);

  const isManager =
    ["owner", "admin", "manager"].includes(String(session.staff.role ?? "").toLowerCase().trim());

  // If not manager, only delete own
  if (!isManager) {
    const { data: existing, error: exErr } = await supabaseServer
      .from("pos_jobs_drafts")
      .select("id, staff_id")
      .eq("id", id)
      .maybeSingle();

    if (exErr) return jsonErr(exErr.message || "Failed to load draft.", 500);
    if (!existing) return jsonErr("Saved job not found.", 404);
    if (Number(existing.staff_id) !== Number(session.staff.id)) return jsonErr("Forbidden", 403);
  }

  const { error } = await supabaseServer.from("pos_jobs_drafts").delete().eq("id", id);

  if (error) return jsonErr(error.message || "Failed to delete saved job.", 500);

  return NextResponse.json({ ok: true });
}
