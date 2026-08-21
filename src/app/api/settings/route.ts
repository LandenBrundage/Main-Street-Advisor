import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import {
  getDemoAccountName,
  getDemoWorkspace,
  saveDemoAccountName,
} from "@/lib/demo-store";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { accountNameSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (ENABLE_DEMO_MODE) {
      const { user, membership } = getDemoWorkspace();
      return NextResponse.json({
        name: getDemoAccountName(),
        email: user.email,
        avatarUrl: null,
        providers: ["email"],
        isOAuthOnly: false,
        accountDeletion: {
          configured: false,
          eligible: false,
          businessName: membership.businesses.name,
        },
      });
    }
    const { supabase, user } = await requireUser();
    const [profileResult, membershipResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,avatar_path")
        .eq("id", user.id)
        .single(),
      supabase
        .from("business_memberships")
        .select("role,businesses(name)")
        .eq("user_id", user.id)
        .limit(2),
    ]);
    const { data, error } = profileResult;
    if (error || !data)
      throw new AppError(
        "SETTINGS_LOAD_FAILED",
        "Account settings could not be loaded.",
      );
    let avatarUrl: string | null = null;
    if (data.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("profile-avatars")
        .createSignedUrl(data.avatar_path, 3600);
      avatarUrl = signed?.signedUrl || null;
    }
    const providers = Array.isArray(user.app_metadata?.providers)
      ? user.app_metadata.providers.filter(
          (provider): provider is string => typeof provider === "string",
        )
      : [String(user.app_metadata?.provider || "email")];
    return NextResponse.json({
      name: data.full_name,
      email: user.email || "",
      avatarUrl,
      providers,
      isOAuthOnly: !providers.includes("email"),
      accountDeletion: {
        configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        eligible:
          membershipResult.data?.length === 1 &&
          membershipResult.data[0]?.role === "owner",
        businessName:
          relatedBusinessName(membershipResult.data?.[0]?.businesses) || "",
      },
    });
  } catch (error) {
    safeDiagnostic("settings-load", error);
    return apiError(error);
  }
}

function relatedBusinessName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

export async function PATCH(request: Request) {
  try {
    const { name } = accountNameSchema.parse(await request.json());
    if (ENABLE_DEMO_MODE) {
      saveDemoAccountName(name);
      return NextResponse.json({ saved: true, name });
    }
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", user.id);
    if (error)
      throw new AppError(
        "SETTINGS_SAVE_FAILED",
        "Your account name could not be saved.",
      );
    return NextResponse.json({ saved: true, name });
  } catch (error) {
    safeDiagnostic("settings-save", error);
    return apiError(error);
  }
}
