import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasAcceptedLegalDocuments } from "@/lib/legal-server";
import { AppError } from "@/lib/http";
export async function createClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("Supabase server environment is not configured.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot set cookies. */
        }
      },
    },
  });
}
export async function requireUser({ requireAcceptance = true } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  if (
    requireAcceptance &&
    !(await hasAcceptedLegalDocuments(supabase, user.id))
  )
    throw new AppError(
      "LEGAL_ACCEPTANCE_REQUIRED",
      "Review and accept the Tester Terms and acknowledge the Privacy Policy to continue.",
      403,
    );
  return { supabase, user };
}
export async function requireWorkspace() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("business_memberships")
    .select("business_id,role,businesses(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (error || !data) throw new Error("WORKSPACE_REQUIRED");
  return { supabase, user, businessId: data.business_id, membership: data };
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
