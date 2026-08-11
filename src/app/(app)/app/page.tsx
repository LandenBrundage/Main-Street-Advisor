import { Chat } from "@/components/chat";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { getDemoAccountName, getDemoWorkspace } from "@/lib/demo-store";
import { requireWorkspace } from "@/lib/supabase/server";
export default async function Page() {
  if (ENABLE_DEMO_MODE) {
    const { membership } = getDemoWorkspace();
    const accountName = getDemoAccountName();
    return (
      <Chat
        firstName={accountName.split(" ")[0] || "there"}
        businessName={membership.businesses.name}
      />
    );
  }
  const { supabase, user, membership } = await requireWorkspace();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const business = membership.businesses as unknown as { name: string };
  return (
    <Chat
      firstName={profile?.full_name?.split(" ")[0] || "there"}
      businessName={business.name}
    />
  );
}
