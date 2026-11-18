/** RFC 4180 cells; prevent spreadsheet formulas in user-controlled strings. */
export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (typeof value === "string" && /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(value))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export const csvLine = (values: unknown[]) =>
  values.map(csvCell).join(",") + "\r\n";
type Row = Record<string, unknown>;
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const one = (value: unknown) => object(Array.isArray(value) ? value[0] : value);
export function flattenExport(row: Row, table: string): Row {
  const {
    bus_stops,
    stop_points,
    feedback_replies,
    stop_feedback_categories,
    stop_feedback_photos,
    ...base
  } = row;
  if (table === "places") return row;
  const place = one(bus_stops);
  const parent = {
    place_name_de: place.name_de,
    place_name_it: place.name_it,
    place_name_en: place.name_en,
    municipality_de: place.municipality_de,
    municipality_it: place.municipality_it,
  };
  if (table === "points") return { ...base, ...parent };
  const point = one(stop_points),
    reply = one(feedback_replies);
  const categories = Array.isArray(stop_feedback_categories)
    ? stop_feedback_categories.map(object)
    : [];
  return {
    ...base,
    ...parent,
    point_number: point.point_number,
    point_name_de: point.name_de,
    point_name_it: point.name_it,
    category_slugs: categories.map((c) => c.category_slug).join(" | "),
    ...Object.fromEntries(
      ["de", "it", "en"].map((lang) => [
        "categories_" + lang,
        categories
          .map((c) => one(c.feedback_categories)["label_" + lang])
          .filter(Boolean)
          .join(" | "),
      ]),
    ),
    photo_count: Array.isArray(stop_feedback_photos)
      ? stop_feedback_photos.length
      : 0,
    reply_id: reply.id,
    reply_body: reply.body,
    reply_public_body: reply.public_body,
    reply_public_updated_at: reply.public_updated_at,
    reply_author_id: reply.author_id,
    reply_created_at: reply.created_at,
    reply_updated_at: reply.updated_at,
  };
}
