import { redirect } from "next/navigation";
import { LegalAcceptanceForm } from "@/components/legal-acceptance-form";
import { requireUser } from "@/lib/supabase/server";
import { legalNextPath } from "@/lib/legal";
import { hasAcceptedLegalDocuments } from "@/lib/legal-server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = legalNextPath((await searchParams).next);
  let auth;
  try {
    auth = await requireUser({ requireAcceptance: false });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED")
      redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
    throw error;
  }
  if (await hasAcceptedLegalDocuments(auth.supabase, auth.user.id))
    redirect(nextPath);
  return <LegalAcceptanceForm nextPath={nextPath} />;
}
