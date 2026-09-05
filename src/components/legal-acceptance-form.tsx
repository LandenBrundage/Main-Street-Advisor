"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  legalNextPath,
  TESTER_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal";

export function LegalAcceptanceForm({
  nextPath = "/app",
  navigateTo = navigateBrowser,
}: {
  nextPath?: string;
  navigateTo?: (url: string) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/legal-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          termsVersion: TESTER_TERMS_VERSION,
          privacyVersion: PRIVACY_POLICY_VERSION,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            "Your acknowledgment could not be saved. Please try again.",
        );
      navigateTo(legalNextPath(nextPath));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to continue. Please try again.",
      );
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      navigateTo("/");
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-md p-7">
      <h1 className="text-2xl font-semibold text-slate-950">
        Before you get started
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Main Street Advisor is being tested. AI guidance can be inaccurate, so
        review it before acting. Messages, documents, and enabled business
        context may be processed by our AI service provider. Share only what you
        need for your consultation.
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Please review the documents below. We’ll save your acknowledgment so you
        won’t need to repeat this unless the documents change.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            id="legal-acceptance"
            type="checkbox"
            required
            disabled={busy}
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 size-4 shrink-0 accent-blue-600"
          />
          <label
            htmlFor="legal-acceptance"
            className="text-sm leading-6 text-slate-600"
          >
            I confirm I am at least 18, agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              Tester Terms
            </Link>
            , and acknowledge the{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Both documents open in a new tab.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={!accepted || busy}
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Agree and
          continue
        </button>
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={busy}
          onClick={signOut}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function navigateBrowser(url: string) {
  window.location.assign(url);
}
