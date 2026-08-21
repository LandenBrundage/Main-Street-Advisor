import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (
      (origin && !matchesRequestHost(request, origin)) ||
      fetchSite === "cross-site"
    )
      return secureResponse(
        NextResponse.json(
          { error: "Cross-site request blocked.", code: "CROSS_SITE_BLOCKED" },
          { status: 403 },
        ),
        true,
      );
  }
  if (ENABLE_DEMO_MODE)
    return secureResponse(NextResponse.next(), path.startsWith("/api/"));
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const protectedRoute = path.startsWith("/app");
  const authRoute =
    path.startsWith("/sign-") || path.startsWith("/reset-password");
  if (protectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return secureResponse(NextResponse.redirect(url), false);
  }
  if (authRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return secureResponse(NextResponse.redirect(url), false);
  }
  return secureResponse(response, path.startsWith("/api/"));
}

function matchesRequestHost(request: NextRequest, origin: string) {
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.slice(0, -1);
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
export const config = {
  matcher: [
    "/api/:path*",
    "/app/:path*",
    "/sign-in",
    "/sign-up",
    "/reset-password",
  ],
};

function secureResponse(response: NextResponse, privateData: boolean) {
  if (privateData) response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
