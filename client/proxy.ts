import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// In Next.js 16, proxy.ts replaces middleware.ts.
// This performs a lightweight, optimistic auth check by inspecting the
// session cookie — no database calls allowed here.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  if (!isProtected) {
    return NextResponse.next();
  }

  const cookieStore = await cookies();
  // next-auth stores the session token in either of these cookies
  const hasSession =
    cookieStore.has("authjs.session-token") ||
    cookieStore.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
