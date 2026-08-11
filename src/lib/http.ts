import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export function safeDiagnostic(scope: string, error: unknown) {
  console.error(
    `[${scope}]`,
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown error" },
  );
}
export function apiError(error: unknown, fallbackStatus = 500) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error:
          error.issues[0]?.message || "Please check the submitted information.",
        code: "VALIDATION_ERROR",
        issues: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "AUTH_REQUIRED")
    return NextResponse.json(
      {
        error: "Your session expired. Please sign in again.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  if (message === "WORKSPACE_REQUIRED")
    return NextResponse.json(
      {
        error:
          "Your business workspace is unavailable. Complete setup or contact support.",
        code: "WORKSPACE_REQUIRED",
      },
      { status: 403 },
    );
  return NextResponse.json(
    {
      error: "Something went wrong. Please try again.",
      code: "INTERNAL_ERROR",
    },
    { status: fallbackStatus },
  );
}
const windows = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now(),
    entry = windows.get(key);
  if (!entry || entry.reset < now) {
    windows.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
