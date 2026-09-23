export type StopPlaceImportRow = {
  nameDe: string;
  nameIt: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  stopCode: string;
};

type DatedStopPlaceImportRow = StopPlaceImportRow & { publicationTimestamp: number };

const REQUIRED_COLUMNS = ["publication_timestamp", "name_it", "name_de", "centroid_location", "private_code"] as const;
const STOP_PLACE_COLUMNS = [
  "tid", "publication_timestamp", "id_version", "valid_between_from_date",
  "valid_between_to_date", "name_it", "name_de", "short_name_it",
  "centroid_location", "topographic_place_ref", "private_code",
] as const;

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

export function readStopPlaceCsv(source: string, onSkipped?: (message: string) => void): StopPlaceImportRow[] {
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
  const firstDataRow = rows.findIndex((row) => row.some((value) => value.trim()));
  const isHeaderlessStopPlace = firstDataRow >= 0 && rows[firstDataRow].length >= STOP_PLACE_COLUMNS.length &&
    /^\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,?\s*\)$/.test(rows[firstDataRow][8]?.trim() ?? "");
  if (headerIndex < 0 && !isHeaderlessStopPlace) {
    const detected = rows[0]?.map(normalizeHeader).filter(Boolean).slice(0, 8).join(", ") || "none";
    throw new Error(`Missing CSV columns: ${REQUIRED_COLUMNS.join(", ")}. Detected first row: ${detected}.`);
  }
  const header = headerIndex >= 0 ? rows[headerIndex].map(normalizeHeader) : [...STOP_PLACE_COLUMNS];
  if (headerIndex >= 0) rows.splice(0, headerIndex + 1);
  else if (firstDataRow > 0) rows.splice(0, firstDataRow);
  const columns = new Map(header.map((name, index) => [name, index]));

  const newestByStopCode = new Map<string, DatedStopPlaceImportRow>();

  rows.forEach((row, rowIndex) => {
    if (row.every((value) => !value.trim())) return;
    const value = (name: string) => row[columns.get(name)!]?.trim() ?? "";
    const coordinates = value("centroid_location").match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,?\s*\)$/);
    if (!coordinates) {
      onSkipped?.(`CSV data row ${rowIndex + 1}: invalid centroid_location.`);
      return [];
    }
    const longitude = Number(coordinates[1]);
    const latitude = Number(coordinates[2]);
    const nameDe = value("name_de");
    const nameIt = value("name_it");
    // Current stop_place exports do not include English names. Keep the
    // application's third language populated with the documented German
    // fallback, but prefer name_en if a future export supplies it.
    const nameEn = value("name_en") || nameDe;
    const stopCode = value("private_code");
    const publicationTimestamp = Date.parse(value("publication_timestamp"));
    if (!nameDe || !nameIt || !stopCode || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      onSkipped?.(`CSV data row ${rowIndex + 1}: incomplete stop data.`);
      return;
    }
    if (!Number.isFinite(publicationTimestamp)) {
      onSkipped?.(`CSV data row ${rowIndex + 1}: invalid publication_timestamp.`);
      return;
    }

    const existing = newestByStopCode.get(stopCode);
    if (!existing || publicationTimestamp > existing.publicationTimestamp) {
      newestByStopCode.set(stopCode, { nameDe, nameIt, nameEn, latitude, longitude, stopCode, publicationTimestamp });
    }
  });

  return Array.from(newestByStopCode.values(), (stop) => ({
    nameDe: stop.nameDe,
    nameIt: stop.nameIt,
    nameEn: stop.nameEn,
    latitude: stop.latitude,
    longitude: stop.longitude,
    stopCode: stop.stopCode,
  }));
}
