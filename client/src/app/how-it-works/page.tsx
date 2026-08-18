"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

export default function HowItWorksPage() {
  const { t } = useLanguage();

  return (
    <main className="content-page">
      <div className="page-title"><h1>{t.how.title}</h1></div>

      <section className="help-section">
        <span className="mini-label">{t.how.eyebrow}</span>
        <p className="help-lead">{t.how.lead}</p>
      </section>

      <section className="help-section">
        <h2>{t.how.stepsTitle}</h2>
        <p className="help-copy">{t.how.copy}</p>
        <div className="steps-grid">
          {t.how.steps.map((step, index) => (
            <article className="step" key={step.title}>
              <span className="step-number" aria-hidden="true">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="help-section help-section-tinted">
        <h2>{t.how.criteriaTitle}</h2>
        <p className="help-copy">{t.how.criteriaCopy}</p>
        <dl className="criteria-grid">
          {t.how.criteria.map((item) => (
            <div className="criteria-item" key={item.title}>
              <dt>{item.title}</dt>
              <dd>{item.copy}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help-section">
        <h2>{t.how.afterTitle}</h2>
        <ol className="after-list">
          {t.how.after.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="help-section">
        <h2>{t.how.faqTitle}</h2>
        <div className="faq-list">
          {t.how.faq.map((entry) => (
            <details key={entry.q}>
              <summary>{entry.q}</summary>
              <p>{entry.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="about-strip">
        <p>{t.about.tagline}</p>
        <Link href="/stops">{t.how.cta} <ArrowIcon /></Link>
      </section>
    </main>
  );
}
