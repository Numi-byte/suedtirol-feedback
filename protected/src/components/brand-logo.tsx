type BrandLogoProps = { tone?: "light" | "dark"; sub?: string };

/**
 * südtirolmobil-style brand lockup: the "M" mark drawn as a route line whose
 * vertices are spheres (places and people connected by mobility), next to the
 * trilingual wordmark offset line by line into an arrow.
 */
export function BrandLogo({ tone = "light", sub = "feedback" }: BrandLogoProps) {
  return (
    <span className="brand-lockup" data-tone={tone}>
      <svg className="brand-mark" viewBox="0 0 52 42" role="img" aria-label="südtirolmobil">
        <path d="M6 37V16l20 15 20-15v21" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="8" r="5" fill="currentColor" />
        <circle cx="46" cy="8" r="5" fill="currentColor" />
        <circle cx="26" cy="31" r="5" fill="currentColor" />
      </svg>
      <span className="brand-word">
        <strong>südtirolmobil</strong>
        <em>altoadigemobilità</em>
        <em>südtirolmubiltà</em>
      </span>
      {sub ? <span className="brand-sub">{sub}</span> : null}
    </span>
  );
}
