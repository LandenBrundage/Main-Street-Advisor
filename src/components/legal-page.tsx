import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/config";

export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <PublicHeader />

      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Effective and last updated {LEGAL_EFFECTIVE_DATE}
        </p>
        <div className="legal-copy mt-10">{children}</div>
      </article>

      <PublicFooter />
    </main>
  );
}
