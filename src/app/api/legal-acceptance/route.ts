import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, AppError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { TESTER_TERMS_VERSION, PRIVACY_POLICY_VERSION } from "@/lib/legal";

const schema = z.object({
  accepted: z.literal(true),
  termsVersion: z.literal(TESTER_TERMS_VERSION),
  privacyVersion: z.literal(PRIVACY_POLICY_VERSION),
});

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser({ requireAcceptance: false });
    schema.parse(await request.json());
    const { error } = await supabase.from("legal_acceptances").upsert(
      {
        user_id: user.id,
        terms_version: TESTER_TERMS_VERSION,
        privacy_version: PRIVACY_POLICY_VERSION,
      },
      {
        onConflict: "user_id,terms_version,privacy_version",
        ignoreDuplicates: true,
      },
    );
    if (error)
      throw new AppError(
        "LEGAL_SAVE_FAILED",
        "Your acknowledgment could not be saved. Please try again.",
        503,
      );
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
