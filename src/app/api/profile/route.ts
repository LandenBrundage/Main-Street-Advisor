import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { getDemoProfile, saveDemoProfile } from "@/lib/demo-store";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import {
  buildBusinessSnapshot,
  mapStoredBusinessProfile,
  profileCompletion,
  profileToLegacyColumns,
} from "@/lib/profile";
import { profileSchema, type ProfileInput } from "@/lib/schemas";
import { requireWorkspace } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (ENABLE_DEMO_MODE) {
      const profile = getDemoProfile();
      return NextResponse.json({
        profile,
        completion: profileCompletion(profile),
      });
    }
    const { supabase, businessId } = await requireWorkspace();
    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();
    if (error || !business)
      throw new AppError(
        "PROFILE_LOAD_FAILED",
        "We couldn’t load your business profile.",
      );
    const profile = mapStoredBusinessProfile({ business });
    return NextResponse.json({
      profile,
      completion: profileCompletion(profile),
    });
  } catch (error) {
    safeDiagnostic("profile-load", error);
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const profile = profileSchema.parse(await request.json());
    if (ENABLE_DEMO_MODE) {
      saveDemoProfile(profile);
      return NextResponse.json({
        saved: true,
        completion: profileCompletion(profile),
      });
    }
    const { supabase, user, businessId } = await requireWorkspace();
    const primaryGoalId = await savePrimaryGoal({
      supabase,
      userId: user.id,
      businessId,
      profile,
    });
    const details = {
      basics: profile.basics,
      offerings: profile.offerings,
      customers: profile.customers,
      performance: profile.performance,
      operations: profile.operations,
      goals: profile.goals,
      advice: profile.advice,
      legacyAdditionalInformation: profile.legacyAdditionalInformation,
    };
    const snapshot = buildBusinessSnapshot(profile);
    const { error: businessError } = await supabase
      .from("businesses")
      .update({
        ...profileToLegacyColumns(profile),
        profile_details: details,
        business_snapshot: snapshot,
        profile_version: 2,
        primary_goal_id: primaryGoalId,
      })
      .eq("id", businessId);
    if (businessError)
      throw new AppError(
        "PROFILE_SAVE_FAILED",
        "Your profile could not be saved. Please try again.",
      );
    return NextResponse.json({
      saved: true,
      completion: profileCompletion(profile),
      primaryGoalId,
    });
  } catch (error) {
    safeDiagnostic("profile-save", error);
    return apiError(error);
  }
}

async function savePrimaryGoal({
  supabase,
  userId,
  businessId,
  profile,
}: {
  supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"];
  userId: string;
  businessId: string;
  profile: ProfileInput;
}) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("primary_goal_id")
    .eq("id", businessId)
    .single();
  if (error)
    throw new AppError(
      "PROFILE_SAVE_FAILED",
      "Your profile could not be saved.",
    );
  const title = profile.goals.primaryGoal.trim();
  if (!title) return null;
  const values = {
    title,
    description: profile.goals.successDefinition || null,
    target_date: profile.goals.targetDate || null,
  };
  if (business?.primary_goal_id) {
    const { data, error: updateError } = await supabase
      .from("goals")
      .update(values)
      .eq("id", business.primary_goal_id)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle();
    if (updateError)
      throw new AppError(
        "PROFILE_SAVE_FAILED",
        "The primary goal could not be updated.",
      );
    if (data) return data.id;
  }
  const { data: matching } = await supabase
    .from("goals")
    .select("id")
    .eq("business_id", businessId)
    .ilike("title", title)
    .limit(1)
    .maybeSingle();
  if (matching) return matching.id;
  const { data: created, error: createError } = await supabase
    .from("goals")
    .insert({
      business_id: businessId,
      created_by: userId,
      ...values,
    })
    .select("id")
    .single();
  if (createError || !created)
    throw new AppError(
      "PROFILE_SAVE_FAILED",
      "The primary goal could not be created.",
    );
  return created.id;
}
