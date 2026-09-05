import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PRODUCT_NAME } from "@/lib/config";

const publicLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
];

const policyLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Tester Terms" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-5 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <Link
          href="/"
          aria-label={`${PRODUCT_NAME} home`}
          className="flex shrink-0 items-center gap-2 font-semibold text-slate-950"
        >
          <BrandLogo className="w-14 sm:w-16" />
          <span className="hidden leading-tight sm:inline">{PRODUCT_NAME}</span>
        </Link>

        <nav
          aria-label="Public navigation"
          className="ml-auto flex items-center gap-5 text-sm text-slate-600 lg:ml-0 lg:mr-auto"
        >
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto mt-3 flex w-full items-center justify-end gap-3 border-t border-slate-100 pt-3 sm:gap-5 lg:mt-0 lg:w-auto lg:shrink-0 lg:border-0 lg:pt-0">
          <nav
            aria-label="Account policies"
            className="mr-auto flex shrink-0 flex-col gap-1 text-xs text-slate-600 sm:mr-0 sm:flex-row sm:items-center sm:gap-5 sm:text-sm"
          >
            {policyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 sm:px-4 sm:text-sm"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
