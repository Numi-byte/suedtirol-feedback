export type Language = "de" | "it" | "en";
export const languages: Language[] = ["de", "it", "en"];

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const translations = {
  de: {
    nav: { find: "Haltestellen", how: "So funktioniert's", about: "Über das Projekt", language: "Sprache ändern", service: "Service Desk", cta: "Feedback geben", home: "Startseite" },
    map: {
      eyebrow: "Haltestellenkarte", title: "Finde deine Haltestelle.", stopsAvailable: "Haltestellen verfügbar",
      choose: "Wähle eine Haltestelle auf der Karte, um Feedback zu geben.",
      noStops: "Es sind noch keine Haltestellen veröffentlicht.",
      bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "Alle Haltestellen", title: "Haltestellen",
      searchLabel: "Haltestelle, Bahnhof oder Gemeinde suchen",
      placeholder: "z. B. Bozen Bahnhof, Meran ...",
      clear: "Suche zurücksetzen", loading: "Haltestellen werden geladen ...",
      countOne: "Haltestelle gefunden", countMany: "Haltestellen gefunden",
      empty: "Keine Haltestelle gefunden.", emptyHint: "Versuche es mit einem anderen Namen oder einer Gemeinde.",
      noStops: "Es sind noch keine Haltestellen veröffentlicht.",
      bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", onMap: "Auf der Karte ansehen",
    },
    how: {
      eyebrow: "Einfach & schnell", title: "So funktioniert's",
      copy: "Kein Konto nötig. Deine Rückmeldung geht direkt an die Stellen, die den öffentlichen Verkehr planen.",
      steps: [
        { title: "Haltestelle finden", copy: "Suche nach Name, Ort oder verwende deinen aktuellen Standort." },
        { title: "Bewerten", copy: "Beantworte ein paar kurze Fragen zu Sauberkeit, Sicherheit und Information." },
        { title: "Etwas bewirken", copy: "Dein Feedback fließt in die Planung barrierefreier Haltestellen ein." },
      ],
      cta: "Jetzt Haltestelle suchen",
    },
    about: {
      eyebrow: "Öffentlicher Verkehr, gemeinsam verbessert", title: "Über das Projekt",
      intro: "Sag uns, was an deiner Haltestelle gut funktioniert – und was besser werden muss. Ohne Anmeldung, in zwei Minuten.",
      passengers: "Mehr als 2.400 Fahrgäste", shared: "haben ihre Erfahrung schon geteilt",
      quote: "Fahrgast aus Bozen", quoteText: "Das neue Wartehäuschen macht das Warten deutlich angenehmer.",
      tagline: "Für alle, die Südtirol täglich in Bewegung halten.", cta: "Jetzt Feedback geben",
    },
    footer: { note: "Ein Projekt für den öffentlichen Nahverkehr in Südtirol.", links: ["Impressum", "Datenschutz", "Barrierefreiheit", "Kontakt"] },
  },
  it: {
    nav: { find: "Fermate", how: "Come funziona", about: "Il progetto", language: "Cambia lingua", service: "Service Desk", cta: "Lascia un feedback", home: "Home" },
    map: {
      eyebrow: "Mappa delle fermate", title: "Trova la tua fermata.", stopsAvailable: "fermate disponibili",
      choose: "Scegli una fermata sulla mappa per lasciare un feedback.",
      noStops: "Non ci sono ancora fermate pubblicate.",
      bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "Tutte le fermate", title: "Fermate",
      searchLabel: "Cerca una fermata, stazione o comune",
      placeholder: "es. Bolzano stazione, Merano ...",
      clear: "Azzera la ricerca", loading: "Caricamento delle fermate ...",
      countOne: "fermata trovata", countMany: "fermate trovate",
      empty: "Nessuna fermata trovata.", emptyHint: "Prova con un altro nome o con un comune.",
      noStops: "Non ci sono ancora fermate pubblicate.",
      bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", onMap: "Vedi sulla mappa",
    },
    how: {
      eyebrow: "Semplice e veloce", title: "Come funziona",
      copy: "Non serve un account. Il tuo riscontro arriva direttamente a chi pianifica il trasporto pubblico.",
      steps: [
        { title: "Trova la fermata", copy: "Cerca per nome, località oppure usa la tua posizione attuale." },
        { title: "Valuta", copy: "Rispondi a poche domande su pulizia, sicurezza e informazioni." },
        { title: "Fai la differenza", copy: "Il tuo feedback entra nella pianificazione di fermate accessibili." },
      ],
      cta: "Cerca una fermata",
    },
    about: {
      eyebrow: "Trasporto pubblico, migliorato insieme", title: "Il progetto",
      intro: "Raccontaci cosa funziona alla tua fermata e cosa va migliorato. Senza registrazione, in due minuti.",
      passengers: "Oltre 2.400 passeggeri", shared: "hanno già condiviso la loro esperienza",
      quote: "Passeggera di Bolzano", quoteText: "La nuova pensilina rende l'attesa molto più piacevole.",
      tagline: "Per chi tiene in movimento l'Alto Adige ogni giorno.", cta: "Lascia un feedback",
    },
    footer: { note: "Un progetto per il trasporto pubblico locale in Alto Adige.", links: ["Note legali", "Privacy", "Accessibilità", "Contatti"] },
  },
  en: {
    nav: { find: "Stops", how: "How it works", about: "About the project", language: "Change language", service: "Service desk", cta: "Give feedback", home: "Home" },
    map: {
      eyebrow: "Stop map", title: "Find your stop.", stopsAvailable: "stops available",
      choose: "Pick a stop on the map to give feedback.",
      noStops: "No stops have been published yet.",
      bus: "Bus", accessible: "Accessible", feedback: "Give feedback", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "All stops", title: "Stops",
      searchLabel: "Search for a stop, station or municipality",
      placeholder: "e.g. Bolzano station, Merano ...",
      clear: "Clear search", loading: "Loading stops ...",
      countOne: "stop found", countMany: "stops found",
      empty: "No stop found.", emptyHint: "Try another name or a municipality.",
      noStops: "No stops have been published yet.",
      bus: "Bus", accessible: "Accessible", feedback: "Give feedback", onMap: "View on the map",
    },
    how: {
      eyebrow: "Simple & quick", title: "How it works",
      copy: "No account needed. Your feedback goes straight to the people who plan public transport.",
      steps: [
        { title: "Find your stop", copy: "Search by stop name, town, or use your current location." },
        { title: "Rate it", copy: "Answer a few short questions on cleanliness, safety and information." },
        { title: "Make a difference", copy: "Your feedback feeds into planning for accessible stops." },
      ],
      cta: "Search for a stop",
    },
    about: {
      eyebrow: "Public transport, improved together", title: "About the project",
      intro: "Tell us what works at your stop — and what needs to get better. No account, two minutes.",
      passengers: "More than 2,400 passengers", shared: "have already shared their experience",
      quote: "Passenger from Bolzano", quoteText: "The new shelter makes waiting so much better.",
      tagline: "For the people who keep South Tyrol moving every day.", cta: "Give feedback now",
    },
    footer: { note: "A project for local public transport in South Tyrol.", links: ["Imprint", "Privacy", "Accessibility", "Contact"] },
  },
} as const;
