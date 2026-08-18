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

      <section className="how-section">
        <div className="section-heading">
          <div><span className="mini-label">{t.how.eyebrow}</span></div>
          <p>{t.how.copy}</p>
        </div>
        <div className="steps-grid">
          {t.how.steps.map((step, index) => (
            <article className="step" key={step.title}>
              <span className="step-number" aria-hidden="true">0{index + 1}</span>
              <div className="step-icon" aria-hidden="true"><span>{index === 0 ? "⌖" : index === 1 ? "✎" : "♡"}</span></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
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
