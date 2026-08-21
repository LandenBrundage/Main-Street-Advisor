import type { Metadata } from "next";
import { AccountSettings } from "@/components/settings/account-settings";
import { PRIVACY_SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <AccountSettings supportEmail={PRIVACY_SUPPORT_EMAIL} />;
}
