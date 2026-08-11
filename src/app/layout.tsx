import type { Metadata, Viewport } from "next";
import "./globals.css";
import {
  BRAND_TRUST_BLUE,
  PRODUCT_DESCRIPTION,
  PRODUCT_LOGO_PATH,
  PRODUCT_NAME,
} from "@/lib/config";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  icons: {
    icon: [{ url: PRODUCT_LOGO_PATH, type: "image/png" }],
    shortcut: PRODUCT_LOGO_PATH,
    apple: [{ url: PRODUCT_LOGO_PATH, type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: BRAND_TRUST_BLUE };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
