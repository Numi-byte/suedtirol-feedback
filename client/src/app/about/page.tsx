"use client";

import Link from "next/link";
import Image from "next/image";
import aboutPhoto from "@/components/3f72773a5988348f83a856ca1da8336deb306b75.jpg";
import { useLanguage } from "@/components/language-provider";

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

export default function AboutPage() {
  const { t, language } = useLanguage();
  const photoAlt = {
    de: "Eine Reisende blickt aus einer Seilbahnkabine auf die Dolomiten.",
    it: "Una viaggiatrice osserva le Dolomiti da una cabina della funivia.",
    en: "A passenger looks out at the Dolomites from a cable car cabin.",
  };

  return (
    <main className="content-page about-page">
      <div className="page-title"><h1>{t.about.title}</h1></div>

      <section className="help-section">
        <div className="prose prose-lead">
          {t.about.lead.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </section>

      <div className="about-photo">
        <Image
          src={aboutPhoto}
          alt={photoAlt[language]}
          sizes="(min-width: 1600px) 1440px, (min-width: 400px) 90vw, calc(100vw - 40px)"
          placeholder="blur"
        />
      </div>

      {t.about.sections.map((section, index) => (
        <section className={index % 2 === 1 ? "help-section help-section-tinted" : "help-section"} key={section.title}>
          <div className="about-section-content">
            <h2>{section.title}</h2>
            <div className="prose">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
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
