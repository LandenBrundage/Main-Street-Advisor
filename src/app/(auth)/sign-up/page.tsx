import { AuthForm } from "@/components/auth-form";
import { ENABLE_DEMO_MODE } from "@/lib/config";
export default function Page() {
  return <AuthForm mode="sign-up" demoMode={ENABLE_DEMO_MODE} />;
}
