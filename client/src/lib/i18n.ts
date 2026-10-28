export type Language = "de" | "it" | "en";
export const languages: Language[] = ["de", "it", "en"];

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const translations = {
  de: {
    nav: { menu: "Menu", closeMenu: "Menü schließen", navigation: "Hauptnavigation", find: "Haltestellenliste", how: "So funktioniert's", about: "Über das Projekt", language: "Sprache ändern", service: "Service Desk", cta: "Feedback geben", home: "Startseite" },
    map: {
      deselect: "Auswahl aufheben", expandSearch: "Haltestellensuche öffnen", pointLabel: "Haltepunkt", selectPoints: "Haltepunkte anzeigen", showPointOnMap: "Haltepunkt auf der Karte ansehen", collapseSearch: "Suche minimieren", stopPoints: "Haltepunkte", pointsLoading: "Haltepunkte werden geladen …", pointsError: "Haltepunkte konnten nicht geladen werden.", noPoints: "Noch keine Haltepunkte importiert.",
      eyebrow: "Haltestellenkarte", title: "Bewerte deine Haltestelle", stopsAvailable: "Haltestellen verfügbar",
      loading: "Karte wird geladen …", loadError: "Die Karte konnte nicht geladen werden.",
      choose: "Wähle eine Haltestelle auf der Karte, um Feedback zu geben.",
      noStops: "Es sind noch keine Haltestellen veröffentlicht.",
      searchLabel: "Haltestellen auf der Karte durchsuchen", searchPlaceholder: "Suche deine Haltestelle", noResults: "Keine passende Haltestelle gefunden.", popularStops: "Meistbewertete Haltestellen",
      bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", comments: "Kommentare ansehen", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "Alle Haltestellen", title: "Haltestellen",
      searchLabel: "Haltestelle, Bahnhof oder Gemeinde suchen",
      placeholder: "z. B. Bozen Bahnhof, Meran ...",
      clear: "Suche zurücksetzen", loading: "Haltestellen werden geladen ...",
      countOne: "Haltestelle gefunden", countMany: "Haltestellen gefunden",
      empty: "Keine Haltestelle gefunden.", emptyHint: "Versuche es mit einem anderen Namen oder einer Gemeinde.",
      noStops: "Es sind noch keine Haltestellen veröffentlicht.",
      bus: "Bus", accessible: "Barrierefrei", feedback: "Feedback geben", comments: "Kommentare ansehen", onMap: "Auf der Karte ansehen",
    },
    how: {
      eyebrow: "Einfach & schnell",
      title: "So funktioniert’s",
      lead: "Hier erfährst du, wie du eine Rückmeldung zu einem bestimmten Haltepunkt abgibst – zum Beispiel zu einem Bussteig, Bahnsteig oder einer Seilbahnstation.",
      copy: "Du brauchst dafür kein Konto.",
      stepsTitle: "Deine Rückmeldung in vier Schritten",
      steps: [
        { title: "Haltepunkt wählen", copy: "Suche deine Haltestelle auf der Karte oder unter „Haltestellenliste“. Wähle dort den passenden Haltepunkt aus und öffne „Feedback geben“." },
        { title: "Problem einordnen", copy: "Wähle die zutreffenden Themen und gib an, wie stark dich das Problem beeinträchtigt: gering, mittel oder hoch." },
        { title: "Details ergänzen", copy: "Wenn du möchtest, beschreibe die Situation genauer oder füge ein Foto hinzu." },
        { title: "Prüfen und absenden", copy: "Kontrolliere deine Angaben in der Übersicht und sende die Rückmeldung ab." },
      ],
      criteriaTitle: "Wozu du Hinweise geben kannst",
      criteriaCopy: "Die Themen im Formular decken folgende Bereiche ab:",
      criteria: [
        { title: "Wetterschutz und Sitzplätze", copy: "Fehlt ein Unterstand, Schatten oder eine Sitzgelegenheit?" },
        { title: "Sicherer Zugang", copy: "Gibt es einen sicheren Gehweg und eine sichere Möglichkeit, die Straße zu überqueren?" },
        { title: "Barrierefreiheit", copy: "Ist der Haltepunkt auch mit Rollstuhl, Gehhilfe oder Kinderwagen gut erreichbar und nutzbar?" },
        { title: "Fahrgastinformation", copy: "Sind Fahrpläne und andere Informationen vorhanden, aktuell und gut lesbar?" },
        { title: "Beleuchtung", copy: "Ist der Wartebereich ausreichend beleuchtet?" },
        { title: "Weitere Ausstattung", copy: "Fehlen Fahrradabstellplätze oder ein Mülleimer?" },
      ],
      faqTitle: "Noch Fragen?",
      faq: [
        { q: "Kann ich zu mehreren Haltepunkten Feedback geben?", a: "Ja. Wähle für jeden Haltepunkt den jeweiligen Eintrag aus und sende eine eigene Rückmeldung." },
        { q: "Meine Haltestelle oder mein Haltepunkt fehlt.", a: "Wende dich an den Service Desk. Rückmeldungen sind nur zu den bereits verfügbaren Haltepunkten möglich." },
        { q: "Muss ich meine E-Mail-Adresse angeben?", a: "Nein. Sie ist nur nötig, wenn du einer Kontaktaufnahme zustimmst. Sie ist nicht öffentlich sichtbar." },
        { q: "Welche Sprachen stehen zur Verfügung?", a: "Du kannst das Formular auf Deutsch, Italienisch oder Englisch ausfüllen." },
      ],
      cta: "Haltepunkt suchen",
    },
    about: {
      eyebrow: "Über das Projekt",
      title: "Über das Projekt",
      lead: [
        "Wie erleben Fahrgäste die Bushaltestellen, Bahnhöfe und Seilbahnstationen in Südtirol? Mit dem „Haltestellen-Check“ tragen die Erfahrungen der Fahrgäste dazu bei, den öffentlichen Nahverkehr zu verbessern.",
      ],
      sections: [
        {
          title: "Bewerte deine Haltestelle",
          body: [
            "Wer kann uns besser sagen, was wir verbessern können, als diejenigen, die täglich mit öffentlichen Verkehrsmitteln unterwegs sind? Was fehlt an der Infrastruktur? Was erschwert den Zugang? Euer Feedback hilft uns, diese Bedürfnisse zu erkennen und gezielte Verbesserungen umzusetzen.",
            "Die Rückmeldungen werden gesammelt und von den zuständigen Stellen analysiert, um anschließend – sofern möglich – entsprechende Maßnahmen umzusetzen.",
          ],
        },
        {
          title: "Rückmeldungen nachvollziehen",
          body: [
            "Für jede Haltestelle kannst du sehen, welche Rückmeldungen eingegangen sind, und die entsprechenden Antworten einsehen. Die Angabe persönlicher Daten ist freiwillig. Alle Rückmeldungen werden anonym veröffentlicht.",
          ],
        },
      ],
      tagline: "Deine Meinung ist uns wichtig: Hilf uns dabei, Haltestellen zu gestalten, die besser auf die Bedürfnisse der Fahrgäste abgestimmt sind.",
      cta: "Bewerte deine Haltestelle",
    },
    footer: { address: "Gerbergasse 60, 39100 Bozen Italien", vatLabel: "Mwst. Nr.", note: "Ein Projekt für den öffentlichen Nahverkehr in Südtirol.", links: ["Impressum", "Datenschutz", "Kontakt"] },
  },
  it: {
    nav: { menu: "Menu", closeMenu: "Chiudi menu", navigation: "Navigazione principale", find: "Elenco fermate", how: "Come funziona", about: "Il progetto", language: "Cambia lingua", service: "Service Desk", cta: "Lascia un feedback", home: "Home" },
    map: {
      deselect: "Deseleziona fermata", expandSearch: "Apri ricerca fermate", pointLabel: "Punto di fermata", selectPoints: "Mostra punti di fermata", showPointOnMap: "Vedi punto sulla mappa", collapseSearch: "Riduci ricerca", stopPoints: "punti di fermata", pointsLoading: "Caricamento dei punti di fermata …", pointsError: "Impossibile caricare i punti di fermata.", noPoints: "Nessun punto di fermata importato.",
      eyebrow: "Mappa delle fermate", title: "Valuta la tua fermata", stopsAvailable: "fermate disponibili",
      loading: "Caricamento della mappa …", loadError: "Non è stato possibile caricare la mappa.",
      choose: "Scegli una fermata sulla mappa per lasciare un feedback.",
      noStops: "Non ci sono ancora fermate pubblicate.",
      searchLabel: "Cerca fermate sulla mappa", searchPlaceholder: "Cerca la tua fermata", noResults: "Nessuna fermata corrispondente trovata.", popularStops: "Fermate più valutate",
      bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", comments: "Vedi i commenti", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "Tutte le fermate", title: "Fermate",
      searchLabel: "Cerca una fermata, stazione o comune",
      placeholder: "es. Bolzano stazione, Merano ...",
      clear: "Azzera la ricerca", loading: "Caricamento delle fermate ...",
      countOne: "fermata trovata", countMany: "fermate trovate",
      empty: "Nessuna fermata trovata.", emptyHint: "Prova con un altro nome o con un comune.",
      noStops: "Non ci sono ancora fermate pubblicate.",
      bus: "Bus", accessible: "Accessibile", feedback: "Lascia un feedback", comments: "Vedi i commenti", onMap: "Vedi sulla mappa",
    },
    how: {
      eyebrow: "Semplice e veloce",
      title: "Come funziona",
      lead: "Qui trovi le istruzioni per lasciare un feedback su un punto di fermata preciso, come una banchina dell’autobus, una banchina ferroviaria o una stazione di funivia.",
      copy: "Non serve un account.",
      stepsTitle: "Il tuo feedback in quattro passi",
      steps: [
        { title: "Scegli il punto", copy: "Cerca la fermata sulla mappa o nella sezione «Elenco fermate». Seleziona il punto di fermata corretto e apri «Lascia un feedback»." },
        { title: "Indica il problema", copy: "Seleziona i temi pertinenti e indica quanto il problema ti limita: gravità bassa, media o alta." },
        { title: "Aggiungi dettagli", copy: "Se vuoi, descrivi meglio la situazione oppure aggiungi una foto." },
        { title: "Controlla e invia", copy: "Verifica i dati nel riepilogo e invia il feedback." },
      ],
      criteriaTitle: "Che cosa puoi segnalare",
      criteriaCopy: "I temi del modulo riguardano questi aspetti:",
      criteria: [
        { title: "Riparo e posti a sedere", copy: "Mancano una pensilina, ombra o posti a sedere?" },
        { title: "Accesso sicuro", copy: "Ci sono un percorso pedonale e un attraversamento stradale sicuri?" },
        { title: "Accessibilità", copy: "Il punto di fermata è raggiungibile e utilizzabile anche con una sedia a rotelle, un deambulatore o un passeggino?" },
        { title: "Informazioni ai passeggeri", copy: "Gli orari e le altre informazioni sono presenti, aggiornati e ben leggibili?" },
        { title: "Illuminazione", copy: "L’area di attesa è illuminata a sufficienza?" },
        { title: "Altre dotazioni", copy: "Mancano parcheggi per biciclette o un cestino?" },
      ],
      faqTitle: "Altre domande?",
      faq: [
        { q: "Posso lasciare feedback su più punti di fermata?", a: "Sì. Seleziona la voce corrispondente a ciascun punto e invia un feedback separato." },
        { q: "La mia fermata o il mio punto di fermata non compare.", a: "Contatta il Service Desk. Puoi inviare feedback solo sui punti di fermata già disponibili." },
        { q: "Devo indicare il mio indirizzo e-mail?", a: "No. Serve solo se acconsenti a essere ricontattato. Non è visibile pubblicamente." },
        { q: "Quali lingue sono disponibili?", a: "Puoi compilare il modulo in tedesco, italiano o inglese." },
      ],
      cta: "Cerca un punto di fermata",
    },
    about: {
      eyebrow: "Il progetto",
      title: "Il progetto",
      lead: [
        "Come vivono i passeggeri le fermate degli autobus, le stazioni ferroviarie e quelle delle funivie in Alto Adige? Con il “Controllo fermate” le esperienze dei viaggiatori contribuiscono a migliorare il trasporto pubblico locale.",
      ],
      sections: [
        {
          title: "Valuta la tua fermata",
          body: [
            "Chi meglio dell’utilizzatore quotidiano del trasporto pubblico può suggerirci in che cosa possiamo migliorare? Cosa manca nell’infrastruttura? Cosa rende difficile l’accesso? I feedback ci aiutano a riconoscere queste esigenze e ad intervenire in modo mirato.",
            "Le segnalazioni vengono raccolte ed analizzate dagli uffici competenti per essere poi, se possibile, implementate.",
          ],
        },
        {
          title: "Consultare i feedback",
          body: [
            "Per ogni fermata puoi vedere quali segnalazioni sono state fatte e consultare le relative risposte. Nessun dato personale è obbligatorio. Tutte le recensioni sono anonime.",
          ],
        },
      ],
      tagline: "La tua opinione è importante: aiutaci a realizzare fermate più adatte alle esigenze di chi viaggia.",
      cta: "Valuta la tua fermata",
    },
    footer: { address: "Via dei Conciapelli 60, 39100 Bolzano", vatLabel: "Partita IVA", note: "Un progetto per il trasporto pubblico locale in Alto Adige.", links: ["Note legali", "Privacy", "Contatti"] },
  },
  en: {
    nav: { menu: "Menu", closeMenu: "Close menu", navigation: "Primary navigation", find: "Stop list", how: "How it works", about: "About the project", language: "Change language", service: "Service desk", cta: "Give feedback", home: "Home" },
    map: {
      deselect: "Deselect stop", expandSearch: "Open stop search", pointLabel: "Stop point", selectPoints: "Show stop points", showPointOnMap: "View stop point on the map", collapseSearch: "Minimize search", stopPoints: "stop points", pointsLoading: "Loading stop points …", pointsError: "Stop points could not be loaded.", noPoints: "No stop points imported yet.",
      eyebrow: "Stop map", title: "Rate your stop", stopsAvailable: "stops available",
      loading: "Loading map …", loadError: "The map could not be loaded.",
      choose: "Pick a stop on the map to give feedback.",
      noStops: "No stops have been published yet.",
      searchLabel: "Search stops on the map", searchPlaceholder: "Search for your stop", noResults: "No matching stop found.", popularStops: "Most rated stops",
      bus: "Bus", accessible: "Accessible", feedback: "Give feedback", comments: "View comments", attribution: OSM_ATTRIBUTION,
    },
    stops: {
      eyebrow: "All stops", title: "Stops",
      searchLabel: "Search for a stop, station or municipality",
      placeholder: "e.g. Bolzano station, Merano ...",
      clear: "Clear search", loading: "Loading stops ...",
      countOne: "stop found", countMany: "stops found",
      empty: "No stop found.", emptyHint: "Try another name or a municipality.",
      noStops: "No stops have been published yet.",
      bus: "Bus", accessible: "Accessible", feedback: "Give feedback", comments: "View comments", onMap: "View on the map",
    },
    how: {
      eyebrow: "Simple & quick",
      title: "How it works",
      lead: "Here is how to give feedback on a specific stop point, such as a bus stand, railway platform or cable car station.",
      copy: "You do not need an account.",
      stepsTitle: "Your feedback in four steps",
      steps: [
        { title: "Choose a stop point", copy: "Find your stop on the map or under “Stop list”. Select the relevant stop point and open “Give feedback”." },
        { title: "Identify the problem", copy: "Choose the relevant topics and indicate how much the problem affects you: low, medium or high severity." },
        { title: "Add details", copy: "If you wish, describe the situation in more detail or add a photo." },
        { title: "Check and submit", copy: "Review your details in the summary and submit your feedback." },
      ],
      criteriaTitle: "What you can report",
      criteriaCopy: "The form covers these areas:",
      criteria: [
        { title: "Shelter and seating", copy: "Is shelter, shade or somewhere to sit missing?" },
        { title: "Safe access", copy: "Is there a safe footpath and a safe place to cross the road?" },
        { title: "Accessibility", copy: "Can people using a wheelchair, walking aid or pushchair reach and use the stop point easily?" },
        { title: "Passenger information", copy: "Are timetables and other information available, up to date and easy to read?" },
        { title: "Lighting", copy: "Is the waiting area adequately lit?" },
        { title: "Other facilities", copy: "Is bicycle parking or a waste bin missing?" },
      ],
      faqTitle: "Any questions?",
      faq: [
        { q: "Can I give feedback on more than one stop point?", a: "Yes. Select the entry for each stop point and submit separate feedback." },
        { q: "My stop or stop point is missing.", a: "Contact the service desk. Feedback can only be submitted for stop points that are already available." },
        { q: "Do I have to give my email address?", a: "No. It is only needed if you agree to be contacted. It is not publicly visible." },
        { q: "Which languages are available?", a: "You can complete the form in German, Italian or English." },
      ],
      cta: "Find a stop point",
    },
    about: {
      eyebrow: "About the project",
      title: "About the project",
      lead: [
        "How do passengers experience South Tyrol’s bus stops, railway stations and cable car stations? Through the “Stop Check” project, passengers’ experiences help improve local public transport.",
      ],
      sections: [
        {
          title: "Rate your stop",
          body: [
            "Who better to tell us what we can improve than the people who use public transport every day? What is missing from the infrastructure? What makes access difficult? Your feedback helps us identify these needs and make targeted improvements.",
            "Reports are collected and analysed by the responsible teams so that appropriate measures can then be implemented wherever possible.",
          ],
        },
        {
          title: "View the feedback",
          body: [
            "For each stop, you can see the feedback received and read the corresponding replies. Providing personal information is optional. All feedback is published anonymously.",
          ],
        },
      ],
      tagline: "Your opinion matters to us: help us create stops that better meet passengers’ needs.",
      cta: "Rate your stop",
    },
    footer: { address: "Via dei Conciapelli 60, 39100 Bolzano, Italy", vatLabel: "VAT No.", note: "A project for local public transport in South Tyrol.", links: ["Imprint", "Privacy", "Contact"] },
  },
} as const;
