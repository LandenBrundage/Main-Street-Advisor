"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  KeyRound,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

type SettingsData = {
  name: string;
  email: string;
  avatarUrl: string | null;
  providers: string[];
  isOAuthOnly: boolean;
};

export function AccountSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Settings could not be loaded.");
        return data as SettingsData;
      })
      .then((data) => {
        setSettings(data);
        setName(data.name);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Settings could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function saveName() {
    if (!name.trim() || busy) return;
    setBusy("name");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Your name could not be saved.");
      setSettings((current) =>
        current ? { ...current, name: data.name } : current,
      );
      setNotice("Account name saved.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your name could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file || busy) return;
    setBusy("avatar");
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/settings/avatar", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Your picture could not be uploaded.");
      setSettings((current) =>
        current ? { ...current, avatarUrl: data.avatarUrl } : current,
      );
      setNotice("Profile picture updated.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your picture could not be uploaded.",
      );
    } finally {
      setBusy("");
    }
  }

  async function removeAvatar() {
    if (busy) return;
    setBusy("avatar");
    setError("");
    try {
      const response = await fetch("/api/settings/avatar", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Your picture could not be removed.");
      setSettings((current) =>
        current ? { ...current, avatarUrl: null } : current,
      );
      setNotice("Profile picture removed.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your picture could not be removed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function changePassword() {
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy("password");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      setNotice(
        settings?.isOAuthOnly
          ? "A password was added to this account."
          : "Password changed successfully.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your password could not be changed.",
      );
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading account settings…
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account identity, profile picture, and sign-in security.
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <Check className="size-4" /> {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-7 space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Profile picture
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            JPEG, PNG, or WebP, up to 5 MB.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div
              className="grid size-20 place-items-center rounded-full bg-blue-100 bg-cover bg-center text-xl font-semibold text-blue-800"
              style={
                settings?.avatarUrl
                  ? { backgroundImage: `url(${settings.avatarUrl})` }
                  : undefined
              }
              aria-label="Current profile picture"
            >
              {!settings?.avatarUrl && initials(settings?.name || "User")}
            </div>
            <label className="btn-secondary cursor-pointer">
              {busy === "avatar" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {settings?.avatarUrl ? "Replace picture" : "Upload picture"}
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                disabled={Boolean(busy)}
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
              />
            </label>
            {settings?.avatarUrl && (
              <button
                className="btn-ghost text-red-700"
                disabled={Boolean(busy)}
                onClick={removeAvatar}
              >
                <Trash2 className="size-4" /> Remove
              </button>
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <UserRound className="size-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">
              Account information
            </h2>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="label">Name</span>
              <input
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span className="label">Email address</span>
              <input
                className="field bg-slate-50 text-slate-500"
                value={settings?.email || ""}
                readOnly
                aria-readonly="true"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Email changes require a separate verified-email flow.
              </span>
            </label>
          </div>
          <button
            className="btn-primary mt-5"
            disabled={Boolean(busy) || !name.trim() || name === settings?.name}
            onClick={saveName}
          >
            {busy === "name" && <Loader2 className="size-4 animate-spin" />}
            Save name
          </button>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">
              Password security
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Your existing password is never retrieved or displayed. The masked
            value below is only a placeholder.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Current password</span>
              <input
                type="password"
                className="field bg-slate-50 text-slate-500"
                value=""
                placeholder="••••••••"
                readOnly
                aria-label="Current password is hidden and unavailable"
              />
            </label>
            <label>
              <span className="label">
                {settings?.isOAuthOnly ? "Set a password" : "New password"}
              </span>
              <input
                type="password"
                className="field"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              <span className="label">Confirm new password</span>
              <input
                type="password"
                className="field"
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </div>
          {settings?.isOAuthOnly && (
            <p className="mt-3 text-sm text-blue-800">
              This account currently signs in through{" "}
              {settings.providers.join(", ")}. You may add a password without
              removing OAuth sign-in.
            </p>
          )}
          <button
            className="btn-primary mt-5"
            disabled={Boolean(busy) || !password || !confirmation}
            onClick={changePassword}
          >
            {busy === "password" && <Loader2 className="size-4 animate-spin" />}
            {settings?.isOAuthOnly ? "Set password" : "Change password"}
          </button>
        </section>
      </div>
    </div>
  );
}
