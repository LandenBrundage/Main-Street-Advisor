import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { apiError, AppError, safeDiagnostic } from "@/lib/http";
import { accountDeletionSchema } from "@/lib/schemas";
import {
  createAdminClient,
  requireWorkspace,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    if (ENABLE_DEMO_MODE)
      throw new AppError(
        "DEMO_DELETE_DISABLED",
        "Account deletion is disabled in the fictional demo workspace.",
        409,
      );
    const { confirmation } = accountDeletionSchema.parse(await request.json());
    const { supabase, user, businessId, membership } = await requireWorkspace();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new AppError(
        "ACCOUNT_DELETE_NOT_CONFIGURED",
        "Account deletion is not configured on this deployment.",
        503,
      );
    if (membership.role !== "owner")
      throw new AppError(
        "OWNER_REQUIRED",
        "Only the workspace owner can delete this account.",
        403,
      );
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("name,vector_store_id")
      .eq("id", businessId)
      .single();
    if (businessError || !business)
      throw new AppError(
        "WORKSPACE_REQUIRED",
        "The workspace could not be loaded for deletion.",
        404,
      );
    if (confirmation !== business.name)
      throw new AppError(
        "DELETE_CONFIRMATION_MISMATCH",
        "Enter the business name exactly to confirm deletion.",
        422,
      );
    const { count: memberCount, error: memberError } = await supabase
      .from("business_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("business_id", businessId);
    if (memberError || memberCount !== 1)
      throw new AppError(
        "SHARED_WORKSPACE_DELETE_BLOCKED",
        "A workspace with additional members cannot be deleted through self-service.",
        409,
      );
    const [{ data: documents, error: documentError }, { data: profile }] =
      await Promise.all([
        supabase
          .from("documents")
          .select("storage_path,openai_file_id,vector_store_id")
          .eq("business_id", businessId),
        supabase
          .from("profiles")
          .select("avatar_path")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
    if (documentError)
      throw new AppError(
        "ACCOUNT_DELETE_FAILED",
        "Stored documents could not be prepared for deletion.",
      );
    const openaiFileIds = new Set(
      (documents || []).flatMap((document) =>
        document.openai_file_id ? [document.openai_file_id] : [],
      ),
    );
    const vectorStoreIds = new Set([
      ...((documents || []).flatMap((document) =>
        document.vector_store_id ? [document.vector_store_id] : [],
      ) as string[]),
      ...(business.vector_store_id ? [business.vector_store_id] : []),
    ]);
    if ((openaiFileIds.size || vectorStoreIds.size) && !process.env.OPENAI_API_KEY)
      throw new AppError(
        "OPENAI_DELETE_NOT_CONFIGURED",
        "OpenAI cleanup is unavailable, so no account data was deleted. Restore the server key and try again.",
        503,
      );
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      for (const vectorStoreId of vectorStoreIds)
        await ignoreMissing(() => openai.vectorStores.delete(vectorStoreId));
      for (const fileId of openaiFileIds)
        await ignoreMissing(() => openai.files.delete(fileId));
    }
    const documentPaths = (documents || []).map(
      (document) => document.storage_path,
    );
    if (documentPaths.length) {
      const { error } = await supabase.storage
        .from("business-documents")
        .remove(documentPaths);
      if (error)
        throw new AppError(
          "ACCOUNT_DELETE_FAILED",
          "Document storage could not be deleted completely. No database records were removed; try again.",
        );
    }
    if (profile?.avatar_path) {
      const { error } = await supabase.storage
        .from("profile-avatars")
        .remove([profile.avatar_path]);
      if (error)
        throw new AppError(
          "ACCOUNT_DELETE_FAILED",
          "The profile picture could not be deleted. No database records were removed; try again.",
        );
    }
    const admin = createAdminClient();
    const { error: workspaceError } = await admin
      .from("businesses")
      .delete()
      .eq("id", businessId);
    if (workspaceError)
      throw new AppError(
        "ACCOUNT_DELETE_FAILED",
        "External files were removed, but the workspace records could not be deleted. Try again to finish cleanup.",
      );
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError)
      throw new AppError(
        "ACCOUNT_DELETE_PARTIAL",
        "Workspace data was deleted, but the sign-in record requires administrator cleanup.",
      );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    safeDiagnostic("account-delete", error);
    return apiError(error);
  }
}

async function ignoreMissing<T>(action: () => Promise<T>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 404) return;
    throw error;
  }
}
