import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ENABLE_DEMO_AI, ENABLE_DEMO_MODE } from "@/lib/config";
import {
  getDemoAccountName,
  getDemoWorkspace,
  listDemoConversations,
} from "@/lib/demo-store";
import { requireWorkspace } from "@/lib/supabase/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (ENABLE_DEMO_MODE) {
    const { user } = getDemoWorkspace();
    const accountName = getDemoAccountName();
    return (
      <AppShell
        demoMode
        demoUsesRealAi={ENABLE_DEMO_AI}
        user={{
          name: accountName || user.email.split("@")[0] || "Business owner",
          email: user.email,
          avatarUrl: null,
        }}
        initialConversations={listDemoConversations()}
      >
        {children}
      </AppShell>
    );
  }
  let auth;
  try {
    auth = await requireWorkspace();
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED")
      redirect("/onboarding");
    redirect("/sign-in");
  }
  const { supabase, user, businessId } = auth;
  const [{ data: profile }, { data: conversations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,avatar_path")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id,title,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl || null;
  }
  return (
    <AppShell
      demoMode={false}
      user={{
        name:
          profile?.full_name || user.email?.split("@")[0] || "Business owner",
        email: user.email || "",
        avatarUrl,
      }}
      initialConversations={conversations || []}
    >
      {children}
    </AppShell>
  );
}
