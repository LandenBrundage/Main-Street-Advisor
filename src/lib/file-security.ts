const extensionByMime: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

export function hasValidUploadSignature({
  name,
  mimeType,
  bytes,
}: {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
}) {
  const expectedExtension = extensionByMime[mimeType];
  if (!expectedExtension || !name.toLowerCase().endsWith(expectedExtension))
    return false;
  const header = new Uint8Array(bytes.slice(0, 8));
  if (mimeType === "application/pdf")
    return String.fromCharCode(...header.slice(0, 5)) === "%PDF-";
  if (mimeType.includes("openxmlformats"))
    return header[0] === 0x50 && header[1] === 0x4b;
  return !header.includes(0);
}
