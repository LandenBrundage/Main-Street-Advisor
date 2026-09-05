import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export default function Page() {
  return <LandingPage />;
}
