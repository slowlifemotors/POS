// FILE: app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  (globalThis as any).__session_cookie_header = cookieHeader;
  const session = await getSession();
  return NextResponse.json({ staff: session.staff });
}
