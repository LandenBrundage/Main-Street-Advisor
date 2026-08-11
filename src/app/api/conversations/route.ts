import { NextResponse } from "next/server";
import { listDemoConversations } from "@/lib/demo-store";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { requireWorkspace } from "@/lib/supabase/server";

export async function GET() {
  try {
    if (ENABLE_DEMO_MODE)
      return NextResponse.json({ conversations: listDemoConversations() });
    const { supabase, businessId } = await requireWorkspace();
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error)
      throw new AppError(
        "CONVERSATIONS_LOAD_FAILED",
        "Recent consultations could not be loaded.",
      );
    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    safeDiagnostic("conversations-list", error);
    return apiError(error);
  }
}
