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
      const { user } = getDemoWorkspace();
      return NextResponse.json({
        name: getDemoAccountName(),
        email: user.email,
        avatarUrl: null,
        providers: ["email"],
        isOAuthOnly: false,
      });
    }
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name,avatar_path")
      .eq("id", user.id)
      .single();
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
    });
  } catch (error) {
    safeDiagnostic("settings-load", error);
    return apiError(error);
  }
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
