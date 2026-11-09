import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ROLES } from "@/lib/constants";

const { auth } = NextAuth(authConfig);
const SLUG_TO_ROLE = Object.fromEntries(Object.entries(ROLES).map(([role, r]) => [r.slug, role]));

// Optimistic route protection by role. Every page and API route still checks
// the role and scope on the server; this only redirects early.
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const slug = pathname.split("/")[1];
  const needed = SLUG_TO_ROLE[slug];
  if (!needed) return NextResponse.next();
  const role = req.auth?.user?.role;
  if (!role) {
    const login = needed === "PATIENT" ? "/login?mode=otp" : "/login?mode=email";
    const url = new URL(login, req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (role !== needed) return NextResponse.redirect(new URL("/" + ROLES[role].slug, req.url));
  return NextResponse.next();
});

export const config = {
  matcher: ["/super-admin/:path*", "/sudo-admin/:path*", "/support/:path*", "/cluster-manager/:path*", "/hospital/:path*", "/patient/:path*"],
};
