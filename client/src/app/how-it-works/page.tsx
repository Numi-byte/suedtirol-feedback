"use client";

import Image from "next/image";
import southTyrolMap from "@/components/Group 6.svg";
import { FeedbackBanner } from "@/components/feedback-banner";
import { useLanguage } from "@/components/language-provider";

export default function HowItWorksPage() {
  const { t } = useLanguage();

  return (
    <main className="content-page info-page how-page">
      <div className="page-title"><h1>{t.how.title}</h1></div>

      <section className="help-section help-intro">
        <span className="mini-label">{t.how.eyebrow}</span>
        <p className="help-lead">{t.how.lead}</p>
      </section>

      <div className="how-region-map">
        <Image src={southTyrolMap} width={377} height={229} alt="" sizes="(min-width: 672px) 640px, calc(100vw - 32px)" />
      </div>

      <section className="help-section how-steps-section">
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

      <FeedbackBanner text={t.about.tagline} cta={t.how.cta} />
    </main>
  );
}
