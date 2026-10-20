import { feedbackCategoryLabels, type FeedbackCategorySlug } from "../../../shared/feedback-categories.ts";
import type { Language } from "./i18n";

type CategoryLabels = { label_de: string; label_it: string; label_en: string };
export type FeedbackCategory = { category_slug: string; feedback_categories: CategoryLabels | CategoryLabels[] | null };

export function reportedIssueLabel(category: FeedbackCategory, language: Language, fallback: string): string {
  const known = feedbackCategoryLabels[language];
  if (Object.hasOwn(known, category.category_slug)) return known[category.category_slug as FeedbackCategorySlug];
  const labels = Array.isArray(category.feedback_categories) ? category.feedback_categories[0] : category.feedback_categories;
  return labels?.[`label_${language}`]?.trim() || labels?.label_en?.trim() || labels?.label_de?.trim() || labels?.label_it?.trim() || fallback;
}
