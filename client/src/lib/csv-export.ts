export const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const rowsToCsv = (rows: unknown[][]): string =>
  rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");

export const downloadCsv = (filename: string, rows: unknown[][]): void => {
  const csv = `\uFEFF${rowsToCsv(rows)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const pushCsvSection = (
  rows: unknown[][],
  sectionTitle: string,
  headers: unknown[],
  dataRows: unknown[][]
): void => {
  if (rows.length > 0) {
    rows.push([]);
  }

  rows.push([sectionTitle]);
  rows.push(headers);
  rows.push(...dataRows);
};

export const pushKeyValueRows = (rows: unknown[][], entries: Array<[string, unknown]>): void => {
  for (const [label, value] of entries) {
    rows.push([label, value]);
  }
};
