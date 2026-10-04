import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/_next/static",
  "/_next/image",
  "/_next/data",
  "/favicon.ico",
  "/imgs"
];

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Inject current path into request headers so server actions / API routes
  // can capture the originating page via `headers().get('x-pathname')`.
  // Dipakai oleh writeAudit() untuk kolom `page` di cross-app activity feed.
  const injectPathname = (responseInit?: Parameters<typeof NextResponse.next>[0]) => {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ ...responseInit, request: { headers: requestHeaders } });
  };

  // Allow public paths (no auth required) — but still inject pathname so
  // public page renders (like /login) can record `page` in audit log.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return injectPathname();
  }

  // req.auth is populated by the auth() wrapper
  if (!req.auth) {
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      "panel.indoplatform.id";
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const loginUrl = new URL(`${proto}://${host}/login`);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return injectPathname();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|imgs|api/auth).*)"
  ]
};
