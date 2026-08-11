import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { spreadsheetToText } from "@/lib/spreadsheet";

describe("spreadsheet conversion", () => {
  it("labels sheets and preserves visible cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Weekly");
    sheet.addRows([
      ["Product", "Sales"],
      ["Coffee", 42],
    ]);
    const data = await workbook.xlsx.writeBuffer();
    const out = await spreadsheetToText(data as ArrayBuffer);
    expect(out).toContain("# Sheet: Weekly");
    expect(out).toContain("Coffee | 42");
  });
});
