import { BrandLogo } from "@/components/brand-logo";

export type Language = "de" | "it" | "en";

const PhoneIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2.5 2.5 0 0 1-2.8 2.5A16.5 16.5 0 0 1 3.5 5.8 2.5 2.5 0 0 1 6 3Z" />
  </svg>
);

type SiteHeaderProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  labels: { find: string; how: string; about: string; language: string; service: string; cta: string };
};

const languages: Language[] = ["de", "it", "en"];

export function SiteHeader({ language, onLanguageChange, labels }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="utility-inner">
          <a className="utility-link" href="tel:+390471220880"><PhoneIcon /> {labels.service} +39 0471 220 880</a>
          <div className="language-switch" role="group" aria-label={labels.language}>
            {languages.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={language === code}
                onClick={() => onLanguageChange(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="header-inner">
        <a className="brand" href="#top" aria-label="südtirolmobil feedback">
          <BrandLogo />
        </a>

        <nav aria-label="Primary navigation">
          <a href="#stop-map">{labels.find}</a>
          <a href="#how-it-works">{labels.how}</a>
          <a href="#about">{labels.about}</a>
        </nav>

        <a className="header-cta" href="#stop-map">{labels.cta}</a>
      </div>
    </header>
  );
}
