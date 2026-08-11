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
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <BrandLogo className="w-20" />
          {PRODUCT_NAME}
        </div>
        {children}
        <p className="max-w-md text-center text-xs leading-5 text-slate-500">
          Consulting support only—not a substitute for licensed legal, tax,
          accounting, or financial advice.
        </p>
      </div>
    </main>
  );
}
