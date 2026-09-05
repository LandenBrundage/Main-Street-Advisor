import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PRODUCT_NAME } from "@/lib/config";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="flex w-full flex-col items-center gap-6">
        <Link
          href="/"
          aria-label={`${PRODUCT_NAME} home`}
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          <BrandLogo className="w-20" />
          {PRODUCT_NAME}
        </Link>
        {children}
        <p className="max-w-md text-center text-xs leading-5 text-slate-500">
          Consulting support only—not a substitute for licensed legal, tax,
          accounting, or financial advice.
        </p>
        <nav
          aria-label="Legal documents"
          className="flex items-center gap-4 text-xs text-slate-500"
        >
          <Link className="hover:text-blue-700 hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="hover:text-blue-700 hover:underline" href="/terms">
            Tester Terms
          </Link>
        </nav>
      </div>
    </main>
  );
}
