import { createClient } from "@/lib/supabase/server";
import { FeedbackThreadsView } from "./feedback-threads-view";
import type { Thread } from "./feedback-threads-view";

export async function FeedbackThreads({ stopId, language }: { stopId: string; language?: string }) {
  if (!stopId) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_public_feedback_threads", { p_bus_stop_id: stopId });
  return <FeedbackThreadsView threads={(data ?? []) as Thread[]} language={language} />;
}
