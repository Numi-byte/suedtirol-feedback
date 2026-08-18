"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <main className="content-page">
      <div className="page-title"><h1>{t.about.title}</h1></div>

      <section className="about-section">
        <div className="about-copy">
          <span className="mini-label">{t.about.eyebrow}</span>
          <p className="about-intro">{t.about.intro}</p>
          <div className="trust-note">
            <div className="avatar-stack" aria-hidden="true"><span>JD</span><span>MK</span><span>LS</span></div>
            <p><strong>{t.about.passengers}</strong>{t.about.shared}</p>
          </div>
        </div>

        <figure className="feedback-bubble">
          <span className="quote">{t.about.quote}</span>
          <p>{t.about.quoteText}</p>
          <div className="stars" aria-hidden="true">★★★★★</div>
        </figure>
      </section>

      <section className="about-strip">
        <p>{t.about.tagline}</p>
        <Link href="/stops">{t.about.cta} <ArrowIcon /></Link>
      </section>
    </main>
  );
}
