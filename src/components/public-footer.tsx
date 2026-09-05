import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  LEGAL_ENTITY_NAME,
  PRIVACY_SUPPORT_EMAIL,
  PRODUCT_NAME,
} from "@/lib/config";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto]">
        <div>
          <Link
            href="/"
            aria-label={`${PRODUCT_NAME} home`}
            className="inline-flex items-center gap-2 font-semibold text-slate-950"
          >
            <BrandLogo className="w-14" />
            <span>{PRODUCT_NAME}</span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
            Practical AI consulting and action planning for small businesses.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-start gap-x-6 gap-y-3 text-sm text-slate-600 md:justify-end"
        >
          <Link className="hover:text-blue-700" href="/#features">
            Features
          </Link>
          <Link className="hover:text-blue-700" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-blue-700" href="/terms">
            Tester Terms
          </Link>
          <a
            className="hover:text-blue-700"
            href={`mailto:${PRIVACY_SUPPORT_EMAIL}`}
          >
            Contact
          </a>
        </nav>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs leading-5 text-slate-400 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {LEGAL_ENTITY_NAME}
          </p>
          <p>
            Consulting support only—not a substitute for licensed professional
            advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
