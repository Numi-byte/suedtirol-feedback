import Link from "next/link";
import type { Language } from "@/lib/i18n";
export const managementLabels = {
  de: {
    form: "Formular",
    environments: "Umgebungen & Kampagnen",
    evaluation: "Auswertung",
    saving: "Wird gespeichert …",
    saved: "Gespeichert.",
    failed: "Die Änderung konnte nicht gespeichert werden.",
    close: "Änderungen verwerfen und schließen",
    reset: "Zurücksetzen",
    save: "Speichern",
  },
  it: {
    form: "Modulo",
    environments: "Ambienti e campagne",
    evaluation: "Valutazione",
    saving: "Salvataggio …",
    saved: "Salvato.",
    failed: "Impossibile salvare.",
    close: "Annulla e chiudi",
    reset: "Ripristina",
    save: "Salva",
  },
  en: {
    form: "Form",
    environments: "Environments & campaigns",
    evaluation: "Evaluation",
    saving: "Saving …",
    saved: "Saved.",
    failed: "Could not save the change.",
    close: "Discard changes and close",
    reset: "Reset",
    save: "Save",
  },
};
export function FeedbackManagementTabs({
  current,
  language,
}: {
  current: "form" | "environments" | "evaluation";
  language: Language;
}) {
  const copy = managementLabels[language];
  return (
    <nav
      className="reply-filters management-tabs"
      aria-label={copy.environments}
    >
      {(
        [
          ["form", "/feedback-settings"],
          ["environments", "/feedback-settings/environments"],
          ["evaluation", "/feedback-settings/evaluation"],
        ] as const
      ).map(([key, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
        >
          {copy[key]}
        </Link>
      ))}
    </nav>
  );
}
