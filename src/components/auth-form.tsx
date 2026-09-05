"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth-redirect";
import { Loader2 } from "lucide-react";
export function AuthForm({
  mode,
  demoMode = false,
  nextPath = "/app",
  initialError = "",
  navigateTo = navigateBrowser,
}: {
  mode: "sign-in" | "sign-up" | "reset";
  demoMode?: boolean;
  nextPath?: string;
  initialError?: string;
  navigateTo?: (url: string) => void;
}) {
  const router = useRouter();
  const destination = safeNextPath(nextPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [sent, setSent] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "credentials" | "reset" | "google" | ""
  >("");
  const busy = Boolean(busyAction);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusyAction(mode === "reset" ? "reset" : "credentials");
    setError("");
    try {
      const s = createClient();
      if (mode === "reset") {
        const { error } = await s.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/update-password`,
        });
        if (error) throw error;
        setSent(true);
      } else if (mode === "sign-up") {
        const { error } = await s.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: oauthCallbackUrl(destination),
          },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await s.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(destination);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to continue. Please try again.",
      );
    } finally {
      setBusyAction("");
    }
  }
  async function google() {
    if (busy) return;
    setBusyAction("google");
    setError("");
    try {
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthCallbackUrl(destination),
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url)
        throw new Error(
          "Google sign-in did not return a redirect. Check the Google provider configuration.",
        );
      navigateTo(data.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google sign-in could not start.",
      );
      setBusyAction("");
    }
  }
  return (
    <div className="card w-full max-w-md p-7">
      <h1 className="text-2xl font-semibold text-slate-950">
        {mode === "sign-in"
          ? "Welcome back"
          : mode === "sign-up"
            ? "Create your account"
            : "Reset your password"}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {mode === "reset"
          ? "We’ll email you a secure reset link."
          : "Practical guidance, organized into action."}
      </p>
      {sent ? (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Check your email for the next step.
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Email</span>
              <input
                className="field"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== "reset" && (
              <label className="block">
                <span className="label">Password</span>
                <input
                  className="field"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {mode !== "reset" && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                For adults 18 and older. Before first use, we’ll ask you to
                agree to the{" "}
                <Link
                  href="/terms"
                  className="font-medium text-blue-700 hover:underline"
                >
                  Tester Terms
                </Link>{" "}
                and acknowledge the{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-blue-700 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button className="btn-primary w-full" disabled={busy}>
              {busyAction && busyAction !== "google" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {mode === "sign-in"
                ? "Sign in"
                : mode === "sign-up"
                  ? "Create account"
                  : "Send reset link"}
            </button>
          </form>
          {mode !== "reset" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                OR
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={google}
                className="btn-secondary w-full"
                disabled={busy}
              >
                {busyAction === "google" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {busyAction === "google"
                  ? "Connecting to Google…"
                  : "Continue with Google"}
              </button>
              {demoMode && (
                <button
                  type="button"
                  onClick={() => router.replace("/demo")}
                  className="btn-secondary mt-3 w-full"
                  disabled={busy}
                >
                  Open demo workspace
                </button>
              )}
            </>
          )}
        </>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === "sign-in" ? (
          <>
            <Link
              className="text-blue-700 hover:underline"
              href="/reset-password"
            >
              Forgot password?
            </Link>
            <span className="mx-2">·</span>
            <Link className="text-blue-700 hover:underline" href="/sign-up">
              Create account
            </Link>
          </>
        ) : (
          <Link className="text-blue-700 hover:underline" href="/sign-in">
            Back to sign in
          </Link>
        )}
      </p>
    </div>
  );
}

function oauthCallbackUrl(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}

function navigateBrowser(url: string) {
  window.location.assign(url);
}
