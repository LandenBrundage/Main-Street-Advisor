import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import {
  ACCEPTED_FILE_TYPES,
  ENABLE_DEMO_MODE,
  MAX_FILE_BYTES,
} from "@/lib/config";
import {
  addDemoDocument,
  deleteDemoDocument,
  listDemoDocuments,
} from "@/lib/demo-store";
import { apiError, safeDiagnostic } from "@/lib/http";
import { AppError, consumeDurableRateLimit } from "@/lib/http";
import { hasValidUploadSignature } from "@/lib/file-security";
import { requireWorkspace } from "@/lib/supabase/server";
import { spreadsheetToText } from "@/lib/spreadsheet";
export const runtime = "nodejs";
export async function GET() {
  try {
    if (ENABLE_DEMO_MODE)
      return NextResponse.json({ documents: listDemoDocuments() });
    const { supabase, businessId } = await requireWorkspace();
    const { data, error } = await supabase
      .from("documents")
      .select("id,name,mime_type,size_bytes,status,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data });
  } catch (e) {
    safeDiagnostic("documents-list", e);
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return apiError(new Error("Choose a file to upload."), 400);
      if (file.size > MAX_FILE_BYTES)
        return apiError(new Error("Files must be 15 MB or smaller."), 400);
      if (!ACCEPTED_FILE_TYPES.includes(file.type as never))
        return apiError(
          new Error("Use a PDF, TXT, CSV, XLSX, or DOCX file."),
          400,
        );
      const document = addDemoDocument({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: "ready",
        storagePath: `demo/${crypto.randomUUID()}/${file.name}`,
      });
      return NextResponse.json({ document }, { status: 201 });
    }
    const { supabase, businessId, user } = await requireWorkspace();
    if (!(await consumeDurableRateLimit(supabase, "document-upload", 30, 3600)))
      throw new AppError(
        "RATE_LIMITED",
        "Several documents were uploaded recently. Please wait before uploading more.",
        429,
      );
    const form = await request.formData(),
      file = form.get("file");
    if (!(file instanceof File))
      return apiError(new Error("Choose a file to upload."), 400);
    if (file.size > MAX_FILE_BYTES)
      return apiError(new Error("Files must be 15 MB or smaller."), 400);
    if (!ACCEPTED_FILE_TYPES.includes(file.type as never))
      return apiError(
        new Error("Use a PDF, TXT, CSV, XLSX, or DOCX file."),
        400,
      );
    const safe = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120);
    const id = crypto.randomUUID(),
      path = `${businessId}/${id}/${safe}`;
    const bytes = await file.arrayBuffer();
    if (!hasValidUploadSignature({ name: file.name, mimeType: file.type, bytes }))
      throw new AppError(
        "INVALID_FILE_CONTENT",
        "The file contents do not match the selected PDF, TXT, CSV, XLSX, or DOCX type.",
        400,
      );
    const { error: uploadError } = await supabase.storage
      .from("business-documents")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        id,
        business_id: businessId,
        uploaded_by: user.id,
        name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: path,
        status: "processing",
      })
      .select("id,name,mime_type,size_bytes,status,created_at")
      .single();
    if (error) {
      await supabase.storage.from("business-documents").remove([path]);
      throw error;
    }
    if (!process.env.OPENAI_API_KEY) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "OpenAI is not configured" })
        .eq("id", id)
        .eq("business_id", businessId);
      return NextResponse.json(
        {
          document: { ...doc, status: "failed" },
          warning:
            "File stored securely, but OpenAI processing is not configured.",
        },
        { status: 201 },
      );
    }
    let uploadedFileId: string | undefined;
    let createdVectorStoreId: string | undefined;
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { data: business } = await supabase
        .from("businesses")
        .select("vector_store_id,name")
        .eq("id", businessId)
        .single();
      let vectorStoreId = business?.vector_store_id;
      if (!vectorStoreId) {
        const store = await openai.vectorStores.create({
          name: `Business workspace ${businessId}`,
        });
        vectorStoreId = store.id;
        createdVectorStoreId = store.id;
        await supabase
          .from("businesses")
          .update({ vector_store_id: vectorStoreId })
          .eq("id", businessId);
      }
      let indexName = file.name,
        indexBytes = bytes,
        indexType = file.type;
      if (file.type.includes("spreadsheetml")) {
        indexName = `${file.name}.md`;
        indexBytes = new TextEncoder().encode(await spreadsheetToText(bytes))
          .buffer as ArrayBuffer;
        indexType = "text/markdown";
      }
      const uploaded = await openai.files.create({
        file: await toFile(new Uint8Array(indexBytes), indexName, {
          type: indexType,
        }),
        purpose: "assistants",
      });
      uploadedFileId = uploaded.id;
      await openai.vectorStores.files.create(vectorStoreId, {
        file_id: uploaded.id,
      });
      const { data: ready } = await supabase
        .from("documents")
        .update({
          status: "ready",
          openai_file_id: uploaded.id,
          vector_store_id: vectorStoreId,
        })
        .eq("id", id)
        .eq("business_id", businessId)
        .select("id,name,mime_type,size_bytes,status,created_at")
        .single();
      return NextResponse.json({ document: ready }, { status: 201 });
    } catch (processingError) {
      safeDiagnostic("document-indexing", processingError);
      if (uploadedFileId)
        await new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          .files.delete(uploadedFileId)
          .catch(() => {});
      if (createdVectorStoreId) {
        await new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          .vectorStores.delete(createdVectorStoreId)
          .catch(() => {});
        await supabase
          .from("businesses")
          .update({ vector_store_id: null })
          .eq("id", businessId)
          .eq("vector_store_id", createdVectorStoreId);
      }
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", id)
        .eq("business_id", businessId);
      return NextResponse.json(
        {
          document: { ...doc, status: "failed" },
          warning:
            "The file was uploaded, but indexing failed. Try processing it again.",
        },
        { status: 201 },
      );
    }
  } catch (e) {
    safeDiagnostic("document-upload", e);
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    if (ENABLE_DEMO_MODE) {
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return apiError(new Error("Document ID is required."), 400);
      if (!deleteDemoDocument(id))
        return apiError(new Error("The document could not be deleted."), 400);
      return new NextResponse(null, { status: 204 });
    }
    const { supabase, businessId } = await requireWorkspace();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return apiError(new Error("Document ID is required."), 400);
    const { data, error } = await supabase
      .from("documents")
      .select("storage_path,openai_file_id,vector_store_id")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();
    if (error) throw error;
    let deletedLastVectorStoreId: string | null = null;
    if (process.env.OPENAI_API_KEY && data.openai_file_id) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .neq("id", id);
      const deletingLastDocument = count === 0;
      if (data.vector_store_id && deletingLastDocument)
        await ignoreMissing(() =>
          openai.vectorStores.delete(data.vector_store_id!),
        );
      else if (data.vector_store_id)
        await ignoreMissing(() =>
          openai.vectorStores.files.delete(data.openai_file_id!, {
            vector_store_id: data.vector_store_id!,
          }),
        );
      await ignoreMissing(() => openai.files.delete(data.openai_file_id!));
      if (deletingLastDocument)
        deletedLastVectorStoreId = data.vector_store_id;
    } else if (data.openai_file_id) {
      throw new AppError(
        "OPENAI_DELETE_NOT_CONFIGURED",
        "OpenAI cleanup is unavailable, so the document was not deleted. Restore the server key and try again.",
        503,
      );
    }
    const { error: storageError } = await supabase.storage
      .from("business-documents")
      .remove([data.storage_path]);
    if (storageError)
      throw new AppError(
        "DOCUMENT_DELETE_FAILED",
        "The stored file could not be deleted completely. Please try again.",
      );
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);
    if (deleteError) throw deleteError;
    if (deletedLastVectorStoreId)
      await supabase
        .from("businesses")
        .update({ vector_store_id: null })
        .eq("id", businessId)
        .eq("vector_store_id", deletedLastVectorStoreId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    safeDiagnostic("document-delete", e);
    return apiError(e);
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
