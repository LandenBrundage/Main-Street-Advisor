import { NextResponse } from "next/server";
import { z } from "zod";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  businessName: z.string().trim().min(1).max(160),
});
export async function POST(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      schema.parse(await request.json());
      return NextResponse.json({ created: true }, { status: 201 });
    }
    const { supabase, user } = await requireUser();
    const v = schema.parse(await request.json());
    const { error } = await supabase.rpc("create_initial_workspace", {
      p_user_id: user.id,
      p_full_name: v.name,
      p_business_name: v.businessName,
    });
    if (error) throw error;
    return NextResponse.json({ created: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH() {
  try {
    if (ENABLE_DEMO_MODE) {
      return NextResponse.json({ completed: true });
    }
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("ONBOARDING_UPDATE_FAILED");
    return NextResponse.json({ completed: true });
  } catch (e) {
    return apiError(e);
  }
}
