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

      <section className="help-section">
        <div className="prose prose-lead">
          {t.about.lead.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>

      {t.about.sections.map((section, index) => (
        <section className={index % 2 === 1 ? "help-section help-section-tinted" : "help-section"} key={section.title}>
          <h2>{section.title}</h2>
          <div className="prose">
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
      ))}

      <section className="help-section">
        <p className="about-closing">{t.about.closing}</p>
      </section>

      <section className="about-strip">
        <p>{t.about.tagline}</p>
        <Link href="/stops">{t.about.cta} <ArrowIcon /></Link>
      </section>
    </main>
  );
}
