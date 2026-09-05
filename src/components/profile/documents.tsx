"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ACCEPTED_FILE_TYPES, MAX_FILE_BYTES } from "@/lib/config";
import { formatBytes } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

type DocumentRecord = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  status: "uploading" | "processing" | "ready" | "failed";
  created_at: string;
};

export function BusinessDocuments() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [pendingDocument, setPendingDocument] = useState<DocumentRecord | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => setDocuments(data.documents || []))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Documents could not be loaded.",
        ),
      );
  }, []);

  async function add(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (
        file.size > MAX_FILE_BYTES ||
        !ACCEPTED_FILE_TYPES.includes(file.type as never)
      ) {
        setError(
          `${file.name} is not a supported PDF, TXT, CSV, XLSX, or DOCX file under 15 MB.`,
        );
        continue;
      }
      const temporary: DocumentRecord = {
        id: crypto.randomUUID(),
        name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        status: "uploading",
        created_at: new Date().toISOString(),
      };
      setDocuments((current) => [temporary, ...current]);
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/documents", {
          method: "POST",
          body,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || `${file.name} could not be uploaded.`);
        setDocuments((current) =>
          current.map((item) =>
            item.id === temporary.id ? data.document : item,
          ),
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : `${file.name} could not be uploaded.`,
        );
        setDocuments((current) =>
          current.map((item) =>
            item.id === temporary.id ? { ...item, status: "failed" } : item,
          ),
        );
      }
    }
  }

  async function remove(document: DocumentRecord) {
    if (removing) return;
    setRemoving(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/documents?id=${document.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "The document could not be deleted.");
      }
      setDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
      setPendingDocument(null);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "The document could not be deleted.";
      setError(message);
      setDeleteError(message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        Uploaded files are private to this workspace and are sent to OpenAI for
        searchable AI indexing. Remove passwords, government/payment
        identifiers, and unnecessary personal information first; file contents
        are treated as business data, never as instructions.{" "}
        <Link
          href="/privacy#ai-and-documents"
          className="font-medium underline underline-offset-2"
        >
          How AI files are handled
        </Link>
        .
      </div>
      <label
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer.files);
        }}
        onDragOver={(event) => event.preventDefault()}
        className={`grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 hover:border-blue-300"
        }`}
      >
        <UploadCloud className="size-7 text-blue-600" />
        <span className="mt-2 text-sm font-semibold">
          Drop files here or browse
        </span>
        <span className="mt-1 text-xs text-slate-500">
          PDF, TXT, CSV, XLSX, or DOCX · up to 15 MB
        </span>
        <input
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.txt,.csv,.xlsx,.docx"
          onChange={(event) => add(event.target.files)}
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 flex gap-2 text-sm text-red-700">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
      <ul className="mt-4 divide-y divide-slate-100">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center gap-3 py-3">
            {document.mime_type.includes("sheet") ||
            document.mime_type.includes("csv") ? (
              <FileSpreadsheet className="size-5 text-emerald-600" />
            ) : (
              <FileText className="size-5 text-blue-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{document.name}</p>
              <p className="text-xs text-slate-500">
                {formatBytes(document.size_bytes)} ·{" "}
                {new Date(document.created_at).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                document.status === "ready"
                  ? "bg-emerald-50 text-emerald-700"
                  : document.status === "failed"
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {document.status}
            </span>
            <button
              onClick={() => {
                setDeleteError("");
                setPendingDocument(document);
              }}
              className="p-2 text-slate-400 hover:text-red-700"
              aria-label={`Delete ${document.name}`}
              disabled={removing}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {!documents.length && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No documents uploaded yet.
        </p>
      )}
      <ConfirmDialog
        open={Boolean(pendingDocument)}
        title="Delete document?"
        description={`“${pendingDocument?.name || "This document"}” will be permanently deleted and removed from the consultant’s document search.`}
        confirmLabel="Delete document"
        busy={removing}
        error={deleteError}
        onCancel={() => {
          if (removing) return;
          setPendingDocument(null);
          setDeleteError("");
        }}
        onConfirm={() => {
          if (pendingDocument) remove(pendingDocument);
        }}
      />
    </div>
  );
}
