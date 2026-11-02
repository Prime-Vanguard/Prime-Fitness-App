import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "./csv";
// Read quoted CSV independently to check delimiters, embedded newlines and field contents.
function read(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += char;
  }
  return rows;
}
describe("spreadsheet-safe CSV", () => {
  it.each([
    "=1+1",
    "+cmd",
    "-formula",
    "@SUM(A1)",
    " \t=1+1",
    "\r\n=1",
    "＝1+1",
    "＋1",
    "－1",
    "＠SUM(A1)",
    "\uFEFF=1",
    "\u200b=1",
    "\u200e=1",
  ])("marks formula-like text %j visibly instead of relying on spreadsheet escapes", (value) => {
    const parsed = read(csvDocument([[value]]));
    expect(parsed).toEqual([[`text: ${value}`]]);
  });
  it("round trips Arabic, quotes, commas and embedded newlines without creating extra cells", () => {
    const rows = [
      ["name", "email", "balance"],
      ['أحمد, "Prime"\nVanguard', "a@test.invalid", -20],
    ];
    expect(read(csvDocument(rows))).toEqual([
      ["name", "email", "balance"],
      ['أحمد, "Prime"\nVanguard', "a@test.invalid", "-20"],
    ]);
  });
  it("retains numeric balances and refuses non-finite values", () => {
    expect(csvCell(-20)).toBe('"-20"');
    expect(csvCell(null)).toBe('""');
    for (const value of [NaN, Infinity, -Infinity])
      expect(() => csvCell(value)).toThrow("non-finite");
  });
});
