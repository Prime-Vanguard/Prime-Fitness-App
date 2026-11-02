/** A visible text marker survives spreadsheet save/reopen without relying on formula quoting quirks. */
export function csvCell(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Cannot export a non-finite number.");
  let text = value == null ? "" : String(value);
  if (
    typeof value === "string" &&
    (/^[\p{Cc}\p{Cf}]/u.test(text) ||
      /^[\s\p{Cc}\p{Cf}]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u.test(text))
  )
    text = `text: ${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function csvDocument(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
