import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/security/headers";

/**
 * Edge proxy: applies security headers and a per-request CSP nonce, and
 * redirects obviously unauthenticated visitors away from protected areas.
 * Real authorization always happens on the server in every page and action;
 * this is a UX shortcut, not a security boundary.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy(nonce, { allowStripe: true, isDev });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-csp", csp);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.includes("session_token"));
  const isProtected = pathname.startsWith("/app") || pathname.startsWith("/super-admin") || pathname.startsWith("/onboarding");
  if (isProtected && !hasSessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    applyHeaders(redirect, csp);
    return redirect;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyHeaders(response, csp);
  return response;
}

function applyHeaders(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) response.headers.set(key, value);
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

export const config = {
  matcher: [
    // Skip static assets and Next internals; API routes get headers from route handlers where relevant.
    "/((?!_next/static|_next/image|favicon.ico|favicon-32.png|icon.svg|apple-icon.png|opengraph-image.png|brand/|og-image.png|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
