"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteHeader } from "@/components/site-header";
import type { Language } from "@/components/site-header";
import { StopMap } from "@/components/stop-map";
import type { BusStop } from "@/components/stop-map";

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const LocationIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

const RouteGraphic = () => (
  <svg className="route-graphic" viewBox="0 0 440 340" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 246h96l72-72h136l88-88" opacity=".55" />
      <path d="M64 40v88l88 88v100" opacity=".4" />
      <path d="M416 262H300l-64-64" opacity=".3" />
    </g>
    <g fill="#fff" stroke="#0069b4" strokeWidth="6">
      <circle cx="120" cy="246" r="15" />
      <circle cx="328" cy="174" r="15" />
      <circle cx="152" cy="216" r="15" />
      <circle cx="236" cy="198" r="11" />
    </g>
  </svg>
);

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const translations = {
  de: {
    nav: { find: "Haltestelle finden", how: "So funktioniert's", about: "Über das Projekt", language: "Sprache ändern", service: "Service Desk", cta: "Feedback geben" },
    eyebrow: "Öffentlicher Verkehr, gemeinsam verbessert",
    title: <>Deine Haltestelle.<br /><em>Deine Meinung.</em></>,
    intro: "Sag uns, was an deiner Haltestelle gut funktioniert – und was besser werden muss. Ohne Anmeldung, in zwei Minuten.",
    searchLabel: "Haltestelle oder Bahnhof suchen",
    placeholder: "z. B. Bozen Bahnhof, Meran ...",
    search: "Suchen", location: "Meinen Standort verwenden",
    passengers: "Mehr als 2.400 Fahrgäste", shared: "haben ihre Erfahrung schon geteilt",
    quote: "Fahrgast aus Bozen", quoteText: "Das neue Wartehäuschen macht das Warten deutlich angenehmer.",
    map: {
      eyebrow: "Haltestellenkarte", title: "Finde deine Haltestelle.",
      stopsAvailable: "Haltestellen verfügbar",
      choose: "Wähle eine Haltestelle auf der Karte, um Feedback zu geben.",
      noStops: "Es sind noch keine Haltestellen veröffentlicht.",
      bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", attribution: OSM_ATTRIBUTION,
    },
    simple: "Einfach & schnell", stepsTitle: "In drei Schritten zu besseren Haltestellen.",
    stepsCopy: "Kein Konto nötig. Deine Rückmeldung geht direkt an die Stellen, die den öffentlichen Verkehr planen.",
    steps: [
      { title: "Haltestelle finden", copy: "Suche nach Name, Ort oder verwende deinen aktuellen Standort." },
      { title: "Bewerten", copy: "Beantworte ein paar kurze Fragen zu Sauberkeit, Sicherheit und Information." },
      { title: "Etwas bewirken", copy: "Dein Feedback fließt in die Planung barrierefreier Haltestellen ein." },
    ],
    footer: "Für alle, die Südtirol täglich in Bewegung halten.", start: "Jetzt Feedback geben",
    footerNote: "Ein Projekt für den öffentlichen Nahverkehr in Südtirol.",
    footerLinks: ["Impressum", "Datenschutz", "Barrierefreiheit", "Kontakt"],
  },
  it: {
    nav: { find: "Trova una fermata", how: "Come funziona", about: "Il progetto", language: "Cambia lingua", service: "Service Desk", cta: "Lascia un feedback" },
    eyebrow: "Trasporto pubblico, migliorato insieme",
    title: <>La tua fermata.<br /><em>La tua opinione.</em></>,
    intro: "Raccontaci cosa funziona alla tua fermata e cosa va migliorato. Senza registrazione, in due minuti.",
    searchLabel: "Cerca una fermata o stazione",
    placeholder: "es. Bolzano stazione, Merano ...",
    search: "Cerca", location: "Usa la mia posizione",
    passengers: "Oltre 2.400 passeggeri", shared: "hanno già condiviso la loro esperienza",
    quote: "Passeggera di Bolzano", quoteText: "La nuova pensilina rende l'attesa molto più piacevole.",
    map: {
      eyebrow: "Mappa delle fermate", title: "Trova la tua fermata.",
      stopsAvailable: "fermate disponibili",
      choose: "Scegli una fermata sulla mappa per lasciare un feedback.",
      noStops: "Non ci sono ancora fermate pubblicate.",
      bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", attribution: OSM_ATTRIBUTION,
    },
    simple: "Semplice e veloce", stepsTitle: "Tre passi per fermate migliori.",
    stepsCopy: "Non serve un account. Il tuo riscontro arriva direttamente a chi pianifica il trasporto pubblico.",
    steps: [
      { title: "Trova la fermata", copy: "Cerca per nome, località oppure usa la tua posizione attuale." },
      { title: "Valuta", copy: "Rispondi a poche domande su pulizia, sicurezza e informazioni." },
      { title: "Fai la differenza", copy: "Il tuo feedback entra nella pianificazione di fermate accessibili." },
    ],
    footer: "Per chi tiene in movimento l'Alto Adige ogni giorno.", start: "Lascia un feedback",
    footerNote: "Un progetto per il trasporto pubblico locale in Alto Adige.",
    footerLinks: ["Note legali", "Privacy", "Accessibilità", "Contatti"],
  },
  en: {
    nav: { find: "Find a stop", how: "How it works", about: "About the project", language: "Change language", service: "Service desk", cta: "Give feedback" },
    eyebrow: "Public transport, improved together",
    title: <>Your stop.<br /><em>Your say.</em></>,
    intro: "Tell us what works at your stop — and what needs to get better. No account, two minutes.",
    searchLabel: "Search for a stop or station",
    placeholder: "e.g. Bolzano station, Merano ...",
    search: "Search", location: "Use my current location",
    passengers: "More than 2,400 passengers", shared: "have already shared their experience",
    quote: "Passenger from Bolzano", quoteText: "The new shelter makes waiting so much better.",
    map: {
      eyebrow: "Stop map", title: "Find your stop.",
      stopsAvailable: "stops available",
      choose: "Pick a stop on the map to give feedback.",
      noStops: "No stops have been published yet.",
      bus: "Bus", accessible: "Accessible", feedback: "Give feedback", attribution: OSM_ATTRIBUTION,
    },
    simple: "Simple & quick", stepsTitle: "Three steps to better stops.",
    stepsCopy: "No account needed. Your feedback goes straight to the people who plan public transport.",
    steps: [
      { title: "Find your stop", copy: "Search by stop name, town, or use your current location." },
      { title: "Rate it", copy: "Answer a few short questions on cleanliness, safety and information." },
      { title: "Make a difference", copy: "Your feedback feeds into planning for accessible stops." },
    ],
    footer: "For the people who keep South Tyrol moving every day.", start: "Give feedback now",
    footerNote: "A project for local public transport in South Tyrol.",
    footerLinks: ["Imprint", "Privacy", "Accessibility", "Contact"],
  },
};

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("de");
  const [stops, setStops] = useState<BusStop[]>([]);
  const text = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    fetch("/api/stops").then((response) => response.ok ? response.json() : []).then(setStops).catch(() => setStops([]));
  }, []);

  return (
    <div id="top">
      <SiteHeader language={language} onLanguageChange={setLanguage} labels={text.nav} />
      <main>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-content">
              <div className="eyebrow"><span /> {text.eyebrow}</div>
              <h1>{text.title}</h1>
              <p className="hero-copy">{text.intro}</p>

              <form className="search-card">
                <label htmlFor="stop-search">{text.searchLabel}</label>
                <div className="search-row">
                  <div className="search-field">
                    <SearchIcon />
                    <input id="stop-search" type="search" placeholder={text.placeholder} />
                  </div>
                  <button type="submit">{text.search} <ArrowIcon /></button>
                </div>
                <button className="location-link" type="button"><LocationIcon /> {text.location}</button>
              </form>

              <div className="trust-note">
                <div className="avatar-stack" aria-hidden="true"><span>JD</span><span>MK</span><span>LS</span></div>
                <p><strong>{text.passengers}</strong>{text.shared}</p>
              </div>
            </div>

            <div className="hero-visual">
              <RouteGraphic />
              <div className="feedback-bubble">
                <span className="quote">{text.quote}</span>
                <p>{text.quoteText}</p>
                <div className="stars" aria-hidden="true">★★★★★</div>
              </div>
            </div>
          </div>
        </section>

        <section className="map-section" id="stop-map" aria-labelledby="map-heading">
          <StopMap stops={stops} language={language} labels={text.map} />
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div><span className="mini-label">{text.simple}</span><h2>{text.stepsTitle}</h2></div><p>{text.stepsCopy}</p>
          </div>
          <div className="steps-grid">
            {text.steps.map((step, index) => (
              <article className="step" key={step.title}>
                <span className="step-number" aria-hidden="true">0{index + 1}</span>
                <div className="step-icon" aria-hidden="true"><span>{index === 0 ? "⌖" : index === 1 ? "✎" : "♡"}</span></div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-strip" id="about">
          <p>{text.footer}</p><a href="#stop-map">{text.start} <ArrowIcon /></a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <BrandLogo tone="dark" />
            <p style={{ margin: "14px 0 0" }}>{text.footerNote}</p>
          </div>
          <div className="footer-links">
            {text.footerLinks.map((link) => <a key={link} href="#top">{link}</a>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
