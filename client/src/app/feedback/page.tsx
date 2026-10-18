import { FeedbackForm } from "./feedback-form";
import { FeedbackThreads } from "./feedback-threads";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ stop?: string; lang?: string; name?: string; location?: string }>;
}) {
  const params = await searchParams;
  const language = ["de", "it", "en"].includes(params.lang ?? "") ? params.lang! : undefined;

  return (
    <main className="feedback-page">
      <FeedbackForm
        stopId={params.stop ?? ""}
        stopName={params.name ?? ""}
        stopLocation={params.location ?? ""}
        language={language}
      />
      <FeedbackThreads stopId={params.stop ?? ""} language={language ?? "de"} />
    </main>
  );
}
