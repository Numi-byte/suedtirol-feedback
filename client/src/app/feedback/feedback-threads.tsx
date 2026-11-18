import { createClient } from "@/lib/supabase/server";
import { FeedbackThreadsView } from "./feedback-threads-view";
import type { Thread } from "./feedback-threads-view";

export async function FeedbackThreads({ pointId, language, categories }: { categories: import("../../../../shared/feedback-form-config").FeedbackCategoryConfig[]; pointId: string; language?: string }) {
  if (!pointId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_stop_point_threads", { p_stop_point_id: pointId });
  if (error) throw new Error("Stop-point discussions could not be loaded.");
  return <FeedbackThreadsView categories={categories} threads={(data ?? []) as Thread[]} language={language} />;
}
