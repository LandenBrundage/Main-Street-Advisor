import ExcelJS from "exceljs";

export async function spreadsheetToText(data: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sections: string[] = [];
  workbook.eachSheet((sheet) => {
    if (sheet.state !== "visible") return;
    const rows: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.formula ? cell.result : cell.value;
        const text =
          value instanceof Date
            ? value.toISOString().slice(0, 10)
            : typeof value === "object" && value !== null
              ? JSON.stringify(value)
              : String(value ?? "");
        cells.push(text.replace(/\|/g, "\\|"));
      });
      rows.push(cells.join(" | "));
    });
    sections.push(`# Sheet: ${sheet.name}\n\n${rows.join("\n")}`);
  });
  return sections.join("\n\n");
}
