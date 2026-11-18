import type { Language } from "@/lib/i18n";
export function CsvDownload({
  language,
  table,
  params = {},
}: {
  language: Language;
  table: "places" | "points" | "feedback";
  params?: Record<string, string>;
}) {
  const text = {
    de: {
      places: "CSV Haltestellen",
      points: "CSV Haltepunkte",
      feedback: "CSV Rückmeldungen",
    },
    it: {
      places: "CSV fermate",
      points: "CSV punti di fermata",
      feedback: "CSV segnalazioni",
    },
    en: {
      places: "Stop places CSV",
      points: "Stop points CSV",
      feedback: "Feedback CSV",
    },
  };
  return (
    <a
      className="csv-download"
      href={`/exports?${new URLSearchParams({ table, ...params })}`}
      download
    >
      {text[language][table]}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" />
      </svg>
    </a>
  );
}
