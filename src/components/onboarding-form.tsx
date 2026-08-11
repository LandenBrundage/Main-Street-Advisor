"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PRODUCT_NAME } from "@/lib/config";
export function OnboardingForm() {
  const [name, setName] = useState(""),
    [business, setBusiness] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, businessName: business }),
    });
    if (r.ok) {
      router.replace("/app");
      router.refresh();
    } else {
      setError((await r.json()).error || "Setup could not be completed.");
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <form onSubmit={submit} className="card w-full max-w-lg p-7">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <BrandLogo className="w-20" />
          {PRODUCT_NAME}
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Tell us about you</h1>
        <p className="mt-2 text-sm text-slate-500">
          We’ll use this to create your private business workspace. You can add
          more detail later.
        </p>
        <div className="mt-6 space-y-4">
          <label>
            <span className="label">Your name</span>
            <input
              className="field"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            <span className="label">Business name</span>
            <input
              className="field"
              required
              maxLength={160}
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              autoComplete="organization"
            />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}Create workspace
        </button>
      </form>
    </main>
  );
}
