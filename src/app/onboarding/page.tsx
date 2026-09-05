import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/http";

export default async function Page() {
  if (!ENABLE_DEMO_MODE) {
    let auth;
    try {
      auth = await requireUser();
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "LEGAL_ACCEPTANCE_REQUIRED"
      )
        redirect("/accept-terms?next=%2Fonboarding");
      if (error instanceof Error && error.message === "AUTH_REQUIRED")
        redirect("/sign-in");
      throw error;
    }
    const { data: membership } = await auth.supabase
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (membership) redirect("/app");
  }
  return <OnboardingForm />;
}
