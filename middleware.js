import { NextResponse } from "next/server";

// Middleware runs on Edge Runtime — cannot use jsonwebtoken
// Just check if session cookie exists. Actual JWT verification happens in layout/API routes.
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (
    pathname === "/login" ||
    pathname === "/mfa-verify" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check session cookie exists
  const session = request.cookies.get("gm06_session");
  if (!session?.value) {
    // API routes return 401, page routes redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
