import { FeedbackForm } from "./feedback-form";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ stop?: string; lang?: string; name?: string; location?: string }>;
}) {
  const params = await searchParams;
  const language = ["de", "it", "en"].includes(params.lang ?? "") ? params.lang! : "de";

  return (
    <main className="feedback-page">
      <FeedbackForm
        stopId={params.stop ?? ""}
        stopName={params.name ?? "Haltestelle"}
        stopLocation={params.location ?? "Südtirol"}
        language={language}
      />
    </main>
  );
}
