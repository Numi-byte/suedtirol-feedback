export type StopPlaceImportRow = {
  nameDe: string;
  nameIt: string;
  latitude: number;
  longitude: number;
  stopCode: string;
};

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
  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  const required = ["name_it", "name_de", "centroid_location", "private_code"];
  const columns = new Map(header.map((name, index) => [name, index]));
  const missing = required.filter((name) => !columns.has(name));
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}.`);

  return rows.flatMap((row, rowIndex) => {
    if (row.every((value) => !value.trim())) return [];
    const value = (name: string) => row[columns.get(name)!]?.trim() ?? "";
    const coordinates = value("centroid_location").match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,?\s*\)$/);
    if (!coordinates) throw new Error(`Invalid centroid_location on CSV row ${rowIndex + 2}.`);
    const longitude = Number(coordinates[1]);
    const latitude = Number(coordinates[2]);
    const nameDe = value("name_de");
    const nameIt = value("name_it");
    const stopCode = value("private_code");
    if (!nameDe || !nameIt || !stopCode || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error(`Incomplete stop data on CSV row ${rowIndex + 2}.`);
    }
    return [{ nameDe, nameIt, latitude, longitude, stopCode }];
  });
}
