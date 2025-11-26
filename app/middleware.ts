import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = url;

  const sessionId = req.cookies.get("session_id")?.value;

  // -------------------------------------------
  // 1. ALWAYS ALLOW API ROUTES
  // -------------------------------------------
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";

  // -------------------------------------------
  // 2. NOT LOGGED IN → only allow /login
  // -------------------------------------------
  if (!sessionId) {
    if (isLoginPage) return NextResponse.next();

    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // -------------------------------------------
  // 3. LOGGED IN → block access to /login
  // -------------------------------------------
  if (isLoginPage) {
    url.pathname = "/pos";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/pos/:path*",
    "/items/:path*",
    "/customers/:path*",
    "/reports/:path*",
    "/categories/:path*",
    "/staff/:path*",
    "/settings/:path*",
    "/api/:path*", // ensure API is matched but passed through
  ],
};
