import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import {
  getDemoAIPrivacySettings,
  saveDemoAIPrivacySettings,
} from "@/lib/demo-store";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { aiPrivacySettingsSchema } from "@/lib/schemas";
import { requireWorkspace } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (ENABLE_DEMO_MODE)
      return NextResponse.json({ settings: getDemoAIPrivacySettings() });
    const { supabase, businessId } = await requireWorkspace();
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "ai_workspace_context_enabled,ai_cross_conversation_enabled,ai_document_search_enabled",
      )
      .eq("id", businessId)
      .single();
    if (error || !data)
      throw new AppError(
        "PRIVACY_SETTINGS_LOAD_FAILED",
        "AI privacy controls could not be loaded.",
      );
    return NextResponse.json({ settings: mapSettings(data) });
  } catch (error) {
    safeDiagnostic("privacy-settings-load", error);
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const settings = aiPrivacySettingsSchema.parse(await request.json());
    if (ENABLE_DEMO_MODE)
      return NextResponse.json({
        saved: true,
        settings: saveDemoAIPrivacySettings(settings),
      });
    const { supabase, businessId } = await requireWorkspace();
    const { data, error } = await supabase
      .from("businesses")
      .update({
        ai_workspace_context_enabled: settings.workspaceContextEnabled,
        ai_cross_conversation_enabled: settings.crossConversationEnabled,
        ai_document_search_enabled: settings.documentSearchEnabled,
      })
      .eq("id", businessId)
      .select(
        "ai_workspace_context_enabled,ai_cross_conversation_enabled,ai_document_search_enabled",
      )
      .single();
    if (error || !data)
      throw new AppError(
        "PRIVACY_SETTINGS_SAVE_FAILED",
        "AI privacy controls could not be saved.",
      );
    return NextResponse.json({ saved: true, settings: mapSettings(data) });
  } catch (error) {
    safeDiagnostic("privacy-settings-save", error);
    return apiError(error);
  }
}

function mapSettings(data: {
  ai_workspace_context_enabled: boolean;
  ai_cross_conversation_enabled: boolean;
  ai_document_search_enabled: boolean;
}) {
  return {
    workspaceContextEnabled: data.ai_workspace_context_enabled,
    crossConversationEnabled: data.ai_cross_conversation_enabled,
    documentSearchEnabled: data.ai_document_search_enabled,
  };
}
