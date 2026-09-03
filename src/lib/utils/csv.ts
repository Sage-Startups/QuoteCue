/** Minimal RFC 4180 CSV utilities (no external dependency). */

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return (columns ?? []).join(",") + "\n";
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    let s = value instanceof Date ? value.toISOString() : String(value);
    // Guard against spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    header.forEach((h, idx) => {
      record[h] = (r[idx] ?? "").trim();
    });
    return record;
  });
}
