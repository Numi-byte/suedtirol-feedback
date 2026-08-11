const GlobeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" />
  </svg>
);

export type Language = "de" | "it" | "en";

type SiteHeaderProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  labels: { find: string; how: string; about: string; language: string };
};

export function SiteHeader({ language, onLanguageChange, labels }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="Südtirol Feedback home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>Südtirol</strong>
            <small>Feedback</small>
          </span>
        </a>

        <nav aria-label="Primary navigation">
          <a href="#stop-map">{labels.find}</a>
          <a href="#how-it-works">{labels.how}</a>
          <a href="#about">{labels.about}</a>
        </nav>

        <label className="language-button" aria-label={labels.language}>
          <GlobeIcon />
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
            <option value="de">DE</option><option value="it">IT</option><option value="en">EN</option>
          </select>
        </label>
      </div>
    </header>
  );
}
