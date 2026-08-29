import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return oauthFailure(
      url,
      providerError === "access_denied"
        ? "oauth_cancelled"
        : "oauth_provider_error",
      next,
    );
  }
  if (!code) return oauthFailure(url, "oauth_missing_code", next);
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    // The public error page intentionally avoids exposing provider diagnostics.
  }
  return oauthFailure(url, "oauth_exchange_failed", next);
}

function oauthFailure(url: URL, error: string, next: string) {
  const destination = new URL("/sign-in", url.origin);
  destination.searchParams.set("error", error);
  destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}
