// app/api/auth/session/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    // In dev, Next.js API routes do NOT reliably forward cookies.
    // We manually forward the cookie header so lib/auth.ts can read it.
    const cookieHeader = (req as any).headers?.get("cookie") ?? "";
    (globalThis as any).__session_cookie_header = cookieHeader;

    const session = await getSession();

    return NextResponse.json({
      staff: session?.staff ?? null,
    });
  } catch (err) {
    console.error("SESSION API ERROR:", err);
    return NextResponse.json({ staff: null });
  }
}
