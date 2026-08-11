import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_TRUST_BLUE,
  PRODUCT_LOGO_PATH,
  PRODUCT_NAME,
} from "@/lib/config";

describe("Main Street Advisor branding", () => {
  it("uses the requested product identity and uploaded PNG", () => {
    expect(PRODUCT_NAME).toBe("Main Street Advisor");
    expect(PRODUCT_LOGO_PATH).toBe("/main-street-advisor-logo.png");

    const logo = readFileSync(
      join(process.cwd(), "public", PRODUCT_LOGO_PATH.slice(1)),
    );
    expect([...logo.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("anchors the interface palette to the logo's trust blue", () => {
    expect(BRAND_TRUST_BLUE).toBe("#003CA2");
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(css).toContain("--color-blue-600: #003ca2;");
  });
});
