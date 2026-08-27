export type StopPlaceImportRow = {
  nameDe: string;
  nameIt: string;
  latitude: number;
  longitude: number;
  stopCode: string;
};

const REQUIRED_COLUMNS = ["name_it", "name_de", "centroid_location", "private_code"] as const;

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").replace(/\\_/g, "_").toLowerCase();
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted field.");
  return rows;
}

export function readStopPlaceCsv(source: string): StopPlaceImportRow[] {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));

  // Some database exports wrap the complete header line in one additional
  // pair of quotes. In that case the first parse correctly preserves its
  // commas as data; parse that single header value once more to get columns.
  rows.slice(0, 20).forEach((row, index) => {
    if (row.length === 1 && row[0]?.includes(",")) {
      const expanded = parseCsv(`${row[0]}\n`)[0];
      if (expanded) rows[index] = expanded;
    }
  });

  // Locate the header instead of assuming it is byte zero. This tolerates a
  // short export preamble before the actual CSV table.
  const headerIndex = rows.slice(0, 20).findIndex((row) => {
    const names = new Set(row.map(normalizeHeader));
    return REQUIRED_COLUMNS.every((name) => names.has(name));
  });
  if (headerIndex < 0) {
    const detected = rows[0]?.map(normalizeHeader).filter(Boolean).slice(0, 8).join(", ") || "none";
    throw new Error(`Missing CSV columns: ${REQUIRED_COLUMNS.join(", ")}. Detected first row: ${detected}.`);
  }
  const header = rows[headerIndex].map(normalizeHeader);
  rows.splice(0, headerIndex + 1);
  const columns = new Map(header.map((name, index) => [name, index]));

  return rows.flatMap((row, rowIndex) => {
    if (row.every((value) => !value.trim())) return [];
    const value = (name: string) => row[columns.get(name)!]?.trim() ?? "";
    const coordinates = value("centroid_location").match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,?\s*\)$/);
    if (!coordinates) throw new Error(`Invalid centroid_location on CSV data row ${rowIndex + 1}.`);
    const longitude = Number(coordinates[1]);
    const latitude = Number(coordinates[2]);
    const nameDe = value("name_de");
    const nameIt = value("name_it");
    const stopCode = value("private_code");
    if (!nameDe || !nameIt || !stopCode || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error(`Incomplete stop data on CSV data row ${rowIndex + 1}.`);
    }
    return [{ nameDe, nameIt, latitude, longitude, stopCode }];
  });
}
