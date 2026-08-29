import { AuthForm } from "@/components/auth-form";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { safeNextPath } from "@/lib/auth-redirect";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  return (
    <AuthForm
      mode="sign-up"
      demoMode={ENABLE_DEMO_MODE}
      nextPath={safeNextPath(nextValue)}
    />
  );
}
