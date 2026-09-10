import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/_next/static",
  "/_next/image",
  "/_next/data",
  "/favicon.ico",
  "/imgs"
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
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

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|imgs|api/auth).*)"
  ]
};
