import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http";
import { TESTER_TERMS_VERSION, PRIVACY_POLICY_VERSION } from "@/lib/legal";

export async function hasAcceptedLegalDocuments(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("accepted_at")
    .eq("user_id", userId)
    .eq("terms_version", TESTER_TERMS_VERSION)
    .eq("privacy_version", PRIVACY_POLICY_VERSION)
    .maybeSingle();
  if (error)
    throw new AppError(
      "LEGAL_CHECK_FAILED",
      "We couldn’t check your acknowledgment. Please try again.",
      503,
    );
  return Boolean(data);
}
