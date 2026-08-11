"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import type { Language } from "@/components/site-header";

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

const translations = {
  de: {
    nav: { find: "Haltestelle finden", how: "So funktioniert's", about: "Über das Projekt", language: "Sprache ändern" }, eyebrow: "Öffentlicher Verkehr, gemeinsam verbessert", title: <>Jede Haltestelle ist es wert,<br /><em>verbessert zu werden.</em></>, intro: "Deine tägliche Erfahrung zählt. Sag uns, was funktioniert – und was an den Haltestellen in Südtirol besser werden könnte.", searchLabel: "Haltestelle oder Bahnhof finden", placeholder: "z. B. Bahnhof Bozen, Meran ...", search: "Suchen", location: "Meinen Standort verwenden", passengers: "Mehr als 2.400 Fahrgäste", shared: "haben ihre Erfahrungen bereits geteilt", explore: "In der Nähe entdecken", mapTitle: "Finde deine Haltestelle auf der Karte.", mapCopy: "Entdecke Haltestellen rund um Bozen. Die Karte nutzt freie, gemeinschaftlich gepflegte OpenStreetMap-Daten und benötigt keinen kostenpflichtigen API-Schlüssel.", mapAria: "OpenStreetMap mit Haltestellen rund um Bozen", selected: "Ausgewählte Haltestelle", train: "Zug", bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", simple: "Einfach & schnell", stepsTitle: "Deine Stimme in drei Schritten.", stepsCopy: "Kein Konto nötig. In wenigen Minuten hilfst du, den öffentlichen Verkehr für alle zu verbessern.", steps: [{ title: "Haltestelle finden", copy: "Suche nach Name, Ort oder deinem aktuellen Standort." }, { title: "Meinung teilen", copy: "Beantworte ein paar einfache Fragen zu deiner Erfahrung." }, { title: "Etwas bewirken", copy: "Dein Feedback hilft, bessere und barrierefreie Haltestellen zu gestalten." }], footer: "Für alle, die Südtirol in Bewegung halten.", start: "Bei deiner Haltestelle starten",
  },
  it: {
    nav: { find: "Trova una fermata", how: "Come funziona", about: "Il progetto", language: "Cambia lingua" }, eyebrow: "Trasporto pubblico, migliorato insieme", title: <>Ogni fermata è un luogo<br />che vale la pena <em>migliorare.</em></>, intro: "La tua esperienza quotidiana conta. Raccontaci cosa funziona e cosa potrebbe migliorare nelle fermate del trasporto pubblico in Alto Adige.", searchLabel: "Trova una fermata o stazione", placeholder: "es. Stazione di Bolzano, Merano...", search: "Cerca", location: "Usa la mia posizione", passengers: "Oltre 2.400 passeggeri", shared: "hanno già condiviso la loro esperienza", explore: "Esplora i dintorni", mapTitle: "Trova la tua fermata sulla mappa.", mapCopy: "Esplora le fermate nei dintorni di Bolzano. La mappa usa i dati OpenStreetMap gratuiti e gestiti dalla comunità, senza chiavi API a pagamento.", mapAria: "OpenStreetMap con le fermate nei dintorni di Bolzano", selected: "Fermata selezionata", train: "Treno", bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", simple: "Semplice e veloce", stepsTitle: "La tua voce in tre passi.", stepsCopy: "Non serve un account. Bastano pochi minuti per migliorare il trasporto pubblico per tutti.", steps: [{ title: "Trova la fermata", copy: "Cerca per nome, località o posizione attuale." }, { title: "Condividi la tua opinione", copy: "Rispondi a poche semplici domande sulla tua esperienza." }, { title: "Fai la differenza", copy: "Il tuo feedback aiuta a creare fermate migliori e più accessibili." }], footer: "Per le persone che tengono in movimento l'Alto Adige.", start: "Inizia dalla tua fermata",
  },
  en: {
    nav: { find: "Find a stop", how: "How it works", about: "About the project", language: "Change language" }, eyebrow: "Public transport, improved together", title: <>Every stop is a place<br />worth <em>improving.</em></>, intro: "Your everyday experience matters. Tell us what works—and what could be better—at public transport stops across South Tyrol.", searchLabel: "Find a stop or station", placeholder: "e.g. Bolzano Station, Merano...", search: "Search", location: "Use my current location", passengers: "Join 2,400+ passengers", shared: "who have already shared their experience", explore: "Explore nearby", mapTitle: "Find your stop on the map.", mapCopy: "Browse public transport stops around Bolzano. The map uses free, community-maintained OpenStreetMap data and needs no paid API key.", mapAria: "OpenStreetMap showing public transport stops around Bolzano", selected: "Selected stop", train: "Train", bus: "Bus", accessible: "Accessible", feedback: "Give feedback", simple: "Simple & quick", stepsTitle: "Your voice, in three steps.", stepsCopy: "No account needed. It only takes a few minutes to help improve public transport for everyone.", steps: [{ title: "Find your stop", copy: "Search by stop name, town, or your current location." }, { title: "Share your view", copy: "Answer a few simple questions about your experience." }, { title: "Make a difference", copy: "Your feedback helps shape better, more accessible stops." }], footer: "Built for the people who keep South Tyrol moving.", start: "Start with your stop",
  },
};

type BusStop = { id: string; name_de: string; name_it: string; name_en: string; municipality: string; latitude: number; longitude: number; is_accessible: boolean };
const mapBounds = { west: 11.3, east: 11.39, south: 46.47, north: 46.52 };

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

  const stopName = (stop: BusStop) => stop[`name_${language}` as "name_de" | "name_it" | "name_en"];
  return (
    <div id="top">
      <SiteHeader language={language} onLanguageChange={setLanguage} labels={text.nav} />
      <main>
        <section className="hero">
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="hero-content">
            <div className="eyebrow"><span /> {text.eyebrow}</div><h1>{text.title}</h1><p className="hero-copy">{text.intro}</p>

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
              <p><strong>{text.passengers}</strong><br />{text.shared}</p>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="mountain mountain-back" />
            <div className="sun" />
            <div className="mountain mountain-front" />
            <div className="route-line"><span /><span /><span /></div>
            <div className="feedback-bubble">
              <span className="quote">“</span>
              <p>The new shelter makes<br />waiting so much better.</p>
              <div className="stars">★★★★★</div>
            </div>
            <div className="stop-sign"><span>BUS</span></div>
          </div>
        </section>

        <section className="map-section" id="stop-map" aria-labelledby="map-heading">
          <div className="map-heading">
            <div>
              <span className="mini-label">{text.explore}</span><h2 id="map-heading">{text.mapTitle}</h2>
            </div>
            <p>{text.mapCopy}</p>
          </div>

          <div className="map-shell">
            <iframe
              className="osm-map"
              title={text.mapAria}
              src="https://www.openstreetmap.org/export/embed.html?bbox=11.3000%2C46.4700%2C11.3900%2C46.5200&amp;layer=mapnik&amp;marker=46.4983%2C11.3548"
              loading="lazy"
            />
            <div className="map-pins" aria-label={text.mapAria}>
              {stops.filter((stop) => stop.longitude >= mapBounds.west && stop.longitude <= mapBounds.east && stop.latitude >= mapBounds.south && stop.latitude <= mapBounds.north).map((stop) => (
                <a
                  className="stop-pin"
                  key={stop.id}
                  href={`/feedback?stop=${encodeURIComponent(stop.id)}&lang=${language}&name=${encodeURIComponent(stopName(stop))}`}
                  aria-label={`${stopName(stop)} – ${text.feedback}`}
                  style={{ left: `${((stop.longitude - mapBounds.west) / (mapBounds.east - mapBounds.west)) * 100}%`, top: `${(1 - (stop.latitude - mapBounds.south) / (mapBounds.north - mapBounds.south)) * 100}%` }}
                ><span>H</span><span className="pin-label">{stopName(stop)}</span></a>
              ))}
            </div>
            <div className="map-panel">
              <span className="map-panel-label">{text.selected}</span>
              <h3>Bolzano / Bozen Station</h3>
              <p>Piazza della Stazione<br />39100 Bolzano</p>
              <div className="transport-tags"><span>{text.train}</span><span>{text.bus}</span><span>{text.accessible}</span></div><a href="#top">{text.feedback} <ArrowIcon /></a>
            </div>
            <a
              className="map-attribution"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div><span className="mini-label">{text.simple}</span><h2>{text.stepsTitle}</h2></div><p>{text.stepsCopy}</p>
          </div>
          <div className="steps-grid">
            {text.steps.map((step, index) => (
              <article className="step" key={step.title}>
                <span className="step-number">0{index + 1}</span>
                <div className="step-icon"><span>{index === 0 ? "⌖" : index === 1 ? "✎" : "♡"}</span></div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-strip" id="about">
          <p>{text.footer}</p><a href="#top">{text.start} <ArrowIcon /></a>
        </section>
      </main>
    </div>
  );
}
