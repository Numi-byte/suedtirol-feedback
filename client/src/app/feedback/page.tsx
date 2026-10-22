import { municipalityName } from "../../../../shared/municipality";
import { notFound, redirect } from "next/navigation";
import { FeedbackForm } from "./feedback-form";
import { FeedbackThreads } from "./feedback-threads";
import { createClient } from "@/lib/supabase/server";
import { translations, type Language } from "@/lib/i18n";
import type { TransportType } from "@/components/transport-icon";
import { stopPointName } from "@/lib/stop-point-links";

type PublishedPoint = { id: string; point_number: string; name_de: string; name_it: string; transport_type: TransportType;
  place_name_de: string; place_name_it: string; place_name_en: string; municipality: string; municipality_de?: string; municipality_it?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FeedbackPage({ searchParams }: {
  searchParams: Promise<{ point?: string; stop?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const language: Language = params.lang === "it" || params.lang === "en" ? params.lang : "de";
  // Old place links lead back to point selection, never to a place-level form.
  if (!params.point) {
    if (params.stop && uuid.test(params.stop)) redirect(`/?stop=${encodeURIComponent(params.stop)}&lang=${language}`);
    redirect("/stops");
  }
  if (!uuid.test(params.point)) notFound();
  const supabase = await createClient();
  const { data: point, error } = await supabase.rpc("get_published_stop_point", { p_stop_point_id: params.point }).returns<PublishedPoint[]>().maybeSingle();
  if (error) throw new Error("Stop point could not be loaded.");
  if (!point) notFound();
  const placeName = point[`place_name_${language}`] || point.place_name_it || point.place_name_de;
  const name = `${placeName} · ${stopPointName(point, language)} · ${translations[language].map.pointLabel} ${point.point_number}`;
  return <main className="feedback-page">
    <FeedbackForm pointId={point.id} stopName={name} stopLocation={municipalityName(point, language)} transportType={point.transport_type} language={language} />
    <FeedbackThreads pointId={point.id} language={language} />
  </main>;
}
