export type FeedbackLanguage = "de" | "it" | "en";
export type FeedbackCategoryConfig = {
  slug: string;
  label_de: string;
  label_it: string;
  label_en: string;
  sort_order: number;
  is_active: boolean;
  icon: unknown;
};
export type FeedbackFormConfig = {
  photos_enabled: boolean;
  max_photo_bytes: number;
  categories: FeedbackCategoryConfig[];
};
export function parseFeedbackFormConfig(value: unknown): FeedbackFormConfig {
  if (!value || typeof value !== "object")
    throw new Error("Feedback configuration unavailable.");
  const v = value as FeedbackFormConfig;
  if (
    typeof v.photos_enabled !== "boolean" ||
    !Number.isInteger(v.max_photo_bytes) ||
    v.max_photo_bytes < 65536 ||
    v.max_photo_bytes > 10485760 ||
    !Array.isArray(v.categories) ||
    v.categories.length > 50 ||
    !v.categories.length
  )
    throw new Error("Invalid feedback configuration.");
  const slugs = new Set<string>();
  for (const row of v.categories) {
    if (
      !row ||
      typeof row.slug !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(row.slug) ||
      slugs.has(row.slug) ||
      !Number.isInteger(row.sort_order) ||
      typeof row.is_active !== "boolean" ||
      [row.label_de, row.label_it, row.label_en].some(
        (x) => typeof x !== "string" || !x.trim() || x.length > 160,
      )
    )
      throw new Error("Invalid feedback category.");
    slugs.add(row.slug);
  }
  if (
    !v.categories.some((c) => c.is_active) ||
    v.categories.filter((c) => c.is_active).length > 30
  )
    throw new Error("No valid active categories.");
  return {
    ...v,
    categories: [...v.categories].sort((a, b) => a.sort_order - b.sort_order),
  };
}
export function feedbackCategoryLabel(
  category: FeedbackCategoryConfig,
  language: FeedbackLanguage,
): string {
  return category[`label_${language}`];
}
export function validFeedbackPhoto(
  file: { type: string; size: number },
  config: FeedbackFormConfig,
) {
  return (
    config.photos_enabled &&
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size <= config.max_photo_bytes &&
    file.size > 0
  );
}
