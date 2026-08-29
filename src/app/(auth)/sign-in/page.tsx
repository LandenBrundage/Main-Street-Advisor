import { AuthForm } from "@/components/auth-form";
import { ENABLE_DEMO_MODE } from "@/lib/config";
import { oauthErrorMessage, safeNextPath } from "@/lib/auth-redirect";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(first(params.next));
  return (
    <AuthForm
      mode="sign-in"
      demoMode={ENABLE_DEMO_MODE}
      nextPath={nextPath}
      initialError={oauthErrorMessage(first(params.error))}
    />
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
