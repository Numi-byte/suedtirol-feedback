export type StopPointImportRow = {
    idVersion: string;
    pointNumber: string;
    latitude: number;
    longitude: number;
    nameDe: string;
    nameIt: string;
};

const COLUMNS = ["id_version", "point_number", "latitude", "longitude", "name_de", "name_it"] as const;
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** The last two components identify the individual scheduled stop point. */
export function stopPointIdentity(idVersion: string) {
    const match = idVersion.trim().match(/^\(([^(),]+):ScheduledStopPoint:([^:(),]+):([^:(),]+):([^:(),]+):([^:(),]+):([^:(),]+),([^(),]+)\)$/);
    if (!match) return null;
    return {
        pointRef: `${match[1]}:ScheduledStopPoint:${match[2]}:${match[3]}:${match[4]}:${match[5]}:${match[6]}`,
        stopPlaceRef: `${match[1]}:StopPlace:${match[2]}:${match[3]}:${match[4]}`,
    };
}

/** The first worksheet row contains the headers; normalized records stay in memory. */
export function readStopPointRows(sheet: readonly (readonly unknown[])[], onSkipped?: (message: string) => void): StopPointImportRow[] {
    const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    const headers = sheet[0]?.map((cell) => text(cell).replace(/^\uFEFF/, "").toLowerCase()) ?? [];
    if (new Set(headers).size !== headers.length) throw new Error("The Excel header contains duplicate column names.");
    const missing = COLUMNS.filter((column) => !headers.includes(column));
    if (missing.length) throw new Error(`Missing Excel columns in row 1: ${missing.join(", ")}.`);
    const columns = new Map(headers.map((name, index) => [name, index]));
    const points = new Map<string, StopPointImportRow>();
    sheet.slice(1).forEach((row, index) => {
        if (row.every((cell) => !text(cell))) return;
        const value = (column: string) => text(row[columns.get(column)!]);
        const idVersion = value("id_version");
        const identity = stopPointIdentity(idVersion);
        const pointNumber = value("point_number");
        const lat = value("latitude");
        const lon = value("longitude");
        const latitude = Number(lat);
        const longitude = Number(lon);
        const nameDe = value("name_de") || value("name_it");
        const nameIt = value("name_it") || value("name_de");
        const problems = [
            ...(!identity ? ["invalid ScheduledStopPoint id_version"] : []),
            ...(!pointNumber ? ["missing point_number"] : []),
            ...(!nameDe || !nameIt ? ["missing name_de and name_it"] : []),
            ...(!NUMERIC.test(lat) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ? ["invalid latitude"] : []),
            ...(!NUMERIC.test(lon) || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ? ["invalid longitude"] : []),
        ];
        if (problems.length || !identity) {
            onSkipped?.(`Excel row ${index + 2}: ${problems.join("; ")}. id_version=${JSON.stringify(idVersion)}`);
            return;
        }
        // No timestamp is supplied: the last row for the same point wins. Distinct
        // point identifiers remain distinct even if they share a point_number.
        points.set(identity.pointRef, { idVersion, pointNumber, latitude, longitude, nameDe, nameIt });
    });
    return [...points.values()];
}

export async function readStopPointExcel(file: File, onSkipped?: (message: string) => void) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file, 1);
    return readStopPointRows(rows, onSkipped);
}