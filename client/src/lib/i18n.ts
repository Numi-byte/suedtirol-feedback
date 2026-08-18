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
      lead: "Auf dieser Plattform bewertest du die Haltestellen in Südtirol aus Sicht der Fahrgäste. Du kennst deine Haltestelle am besten: ob der Wetterschutz fehlt, die Beleuchtung zu schwach ist oder der Fahrplan nicht lesbar hängt.",
      copy: "Kein Konto nötig. Deine Rückmeldung geht direkt an die Stellen, die den öffentlichen Verkehr planen.",
      stepsTitle: "In vier Schritten zur Rückmeldung",
      steps: [
        { title: "Haltestelle auswählen", copy: "Öffne die Karte auf der Startseite und klicke auf eine Haltestelle. Oder suche sie unter „Haltestellen“ nach Name, Bahnhof oder Gemeinde." },
        { title: "Bewertung abgeben", copy: "Vergib eine Gesamtnote von 1 bis 5 und bewerte anschließend die einzelnen Bereiche von der Sauberkeit bis zur Barrierefreiheit." },
        { title: "Ausstattung angeben", copy: "Halte fest, ob Wetterschutz, Sitzgelegenheit und Beleuchtung vorhanden sind, und beschreibe im Textfeld, was konkret verbessert werden soll." },
        { title: "Absenden", copy: "Ohne Anmeldung, in rund zwei Minuten. Eine E-Mail-Adresse kannst du freiwillig angeben, wenn wir zu deiner Rückmeldung nachfragen dürfen." },
      ],
      criteriaTitle: "Was du bewerten kannst",
      criteriaCopy: "Jede Haltestelle wird in fünf Bereichen mit einer Note von 1 bis 5 bewertet. Dazu hältst du fest, was tatsächlich vorhanden ist.",
      criteria: [
        { title: "Sauberkeit", copy: "Zustand von Wartehäuschen, Sitzbank und Umfeld: Abfall, Verschmutzung und Beschädigungen." },
        { title: "Sicherheitsgefühl", copy: "Wie sicher fühlst du dich beim Warten – besonders am Abend und in der dunklen Jahreszeit?" },
        { title: "Barrierefreiheit", copy: "Stufenloser Zugang, Bordsteinhöhe, taktile Leitsysteme und genug Platz für Rollstuhl oder Kinderwagen." },
        { title: "Fahrgastinformation", copy: "Fahrplan, Liniennummern und Echtzeitanzeige: vorhanden, aktuell und gut lesbar?" },
        { title: "Wetterschutz", copy: "Schutz vor Regen, Wind und Sonne. Gerade im Sommer zählt auch der Schatten." },
        { title: "Ausstattung", copy: "Zusätzlich gibst du an, ob Wetterschutz, Sitzgelegenheit und Beleuchtung überhaupt vorhanden sind." },
      ],
      afterTitle: "Was mit deiner Rückmeldung passiert",
      after: [
        { title: "Gesammelt", copy: "Jede Bewertung wird gespeichert und genau der Haltestelle zugeordnet, die du ausgewählt hast." },
        { title: "Ausgewertet", copy: "Im internen Portal sehen die zuständigen Stellen alle Einzelnoten, die Ausstattung und deinen Kommentar." },
        { title: "Verbessert", copy: "So wird sichtbar, an welchen Haltestellen Wetterschutz, Beleuchtung oder Barrierefreiheit am dringendsten fehlen." },
      ],
      faqTitle: "Häufige Fragen",
      faq: [
        { q: "Brauche ich ein Konto?", a: "Nein. Du kannst jede veröffentlichte Haltestelle ohne Anmeldung bewerten." },
        { q: "Kann ich mehrere Haltestellen bewerten?", a: "Ja. Bewerte so viele Haltestellen, wie du kennst. Jede Rückmeldung wird einzeln gespeichert." },
        { q: "Meine Haltestelle ist nicht auf der Karte.", a: "Auf der Karte erscheinen nur Haltestellen, die im Verwaltungsportal veröffentlicht wurden. Fehlt deine, melde sie über den Service Desk." },
        { q: "Was passiert mit meiner E-Mail-Adresse?", a: "Die Angabe ist freiwillig. Sie wird nur gespeichert, wenn du dem Kontakt ausdrücklich zustimmst, und ist ausschließlich für die zuständigen Stellen sichtbar." },
        { q: "In welcher Sprache kann ich antworten?", a: "Auf Deutsch, Italienisch oder Englisch. Die gewählte Sprache wird mit deiner Rückmeldung gespeichert." },
      ],
      cta: "Jetzt Haltestelle suchen",
    },
    about: {
      eyebrow: "Über das Projekt", title: "Über das Projekt",
      lead: [
        "Mit dem Projekt „Haltestellencheck“ möchten wir die Fahrgäste aktiv in die Weiterentwicklung des öffentlichen Verkehrs in Südtirol einbeziehen. Im Mittelpunkt stehen dabei die Bushaltestellen und Bahnhöfe des öffentlichen Nahverkehrs und die Frage, wie die Nutzerinnen und Nutzer ihren Aufenthalt und ihre Erfahrungen vor Ort wahrnehmen.",
        "Die Fahrgäste erhalten die Möglichkeit, ihre persönliche Erfahrung direkt mit uns zu teilen, konkrete Verbesserungsvorschläge einzubringen und auf positive Aspekte aufmerksam zu machen. Damit wird das Feedback der Fahrgäste zu einem wichtigen Bestandteil der kontinuierlichen Verbesserung des öffentlichen Verkehrsangebots.",
      ],
      sections: [
        {
          title: "So funktioniert der Haltestellencheck",
          body: [
            "Über eine Online-Umfrage können Fahrgäste eine von ihnen genutzte Haltestelle oder Station bewerten. Dabei können verschiedene Aspekte der jeweiligen Haltestelle beurteilt werden, beispielsweise Ausstattung, Sauberkeit, Information, Komfort, Barrierefreiheit oder das allgemeine Erscheinungsbild.",
            "Neben der allgemeinen Bewertung besteht auch die Möglichkeit, konkrete Mängel und Verbesserungspotenziale zu melden. Gleichzeitig können Fahrgäste positive Erfahrungen hervorheben und auf Ausstattungsmerkmale aufmerksam machen, die sie besonders schätzen und die ihrer Meinung nach auch an anderen Haltestellen sinnvoll wären.",
            "Der Haltestellencheck soll damit nicht nur Probleme sichtbar machen, sondern ausdrücklich auch gute Beispiele und positive Erfahrungen erfassen. So können Anregungen der Fahrgäste dazu beitragen, bewährte Lösungen künftig auch an anderen Standorten einzusetzen.",
          ],
        },
        {
          title: "Regelmäßige Feedbackphasen",
          body: [
            "Die Online-Umfrage wird zu festgelegten Zeiträumen im Laufe des Jahres geöffnet. Nach Abschluss jeder Feedbackphase werden die eingegangenen Rückmeldungen gesammelt und systematisch ausgewertet.",
            "Die Ergebnisse dienen als Grundlage, um häufig genannte Probleme zu erkennen, Verbesserungsvorschläge zu prüfen und – sofern dies möglich und sinnvoll ist – konkrete Maßnahmen zur Verbesserung der Haltestellen und Stationen abzuleiten und umzusetzen.",
            "Auf diese Weise entsteht ein kontinuierlicher Kreislauf aus Feedback, Analyse, Verbesserung und erneuter Bewertung.",
          ],
        },
        {
          title: "Transparenz durch Ergebnisse in Echtzeit",
          body: [
            "Ein weiterer wichtiger Bestandteil des Projekts ist die Transparenz der Ergebnisse. Fahrgäste können nicht nur ihre eigene Meinung abgeben, sondern auch die bereits eingegangenen Bewertungen und Ergebnisse einsehen.",
            "Dadurch erhalten sie unmittelbar einen Eindruck davon, wie andere Fahrgäste dieselbe Haltestelle oder Station bewerten. Die gesammelten Ergebnisse machen somit unterschiedliche Wahrnehmungen sichtbar und schaffen eine zusätzliche Orientierung für die Nutzerinnen und Nutzer.",
          ],
        },
        {
          title: "Gemeinsam den öffentlichen Verkehr weiterentwickeln",
          body: [
            "Der Haltestellencheck schafft eine direkte Verbindung zwischen den Erfahrungen der Fahrgäste und der Weiterentwicklung des öffentlichen Verkehrs in Südtirol. Die Nutzerinnen und Nutzer werden dabei nicht nur als Fahrgäste, sondern als aktive Mitgestalterinnen und Mitgestalter verstanden.",
            "Durch das kontinuierliche Sammeln und Auswerten der Rückmeldungen entsteht ein wertvoller Erfahrungsschatz, der dabei helfen kann, die Qualität, Ausstattung und Aufenthaltsqualität der Haltestellen und Stationen langfristig zu verbessern.",
          ],
        },
      ],
      closing: "Denn wer den öffentlichen Verkehr täglich nutzt, weiß am besten, was vor Ort gut funktioniert – und wo es noch Verbesserungspotenzial gibt.",
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
      lead: "Su questa piattaforma valuti le fermate dell'Alto Adige dal punto di vista di chi le usa ogni giorno. Sei tu a conoscere la tua fermata: se manca la pensilina, se l'illuminazione è insufficiente o se l'orario è illeggibile.",
      copy: "Non serve un account. Il tuo riscontro arriva direttamente a chi pianifica il trasporto pubblico.",
      stepsTitle: "In quattro passi",
      steps: [
        { title: "Scegli la fermata", copy: "Apri la mappa in home page e clicca su una fermata. Oppure cercala in «Fermate» per nome, stazione o comune." },
        { title: "Dai la tua valutazione", copy: "Assegna un voto complessivo da 1 a 5 e valuta poi i singoli aspetti, dalla pulizia all'accessibilità." },
        { title: "Indica la dotazione", copy: "Segnala se ci sono pensilina, posti a sedere e illuminazione e descrivi nel campo di testo che cosa andrebbe migliorato." },
        { title: "Invia", copy: "Senza registrazione, in circa due minuti. Puoi lasciare un indirizzo e-mail se acconsenti a essere ricontattato." },
      ],
      criteriaTitle: "Che cosa puoi valutare",
      criteriaCopy: "Ogni fermata viene valutata in cinque ambiti con un voto da 1 a 5. In più indichi che cosa è davvero presente.",
      criteria: [
        { title: "Pulizia", copy: "Stato della pensilina, della panchina e dell'area circostante: rifiuti, sporcizia e danneggiamenti." },
        { title: "Senso di sicurezza", copy: "Quanto ti senti sicuro mentre aspetti, soprattutto la sera e nei mesi bui." },
        { title: "Accessibilità", copy: "Accesso senza gradini, altezza del marciapiede, percorsi tattili e spazio per carrozzina o passeggino." },
        { title: "Informazioni ai passeggeri", copy: "Orari, numeri di linea e display in tempo reale: ci sono, sono aggiornati e leggibili?" },
        { title: "Protezione dalle intemperie", copy: "Riparo da pioggia, vento e sole. In estate conta anche l'ombra." },
        { title: "Dotazione", copy: "Indichi inoltre se pensilina, posti a sedere e illuminazione sono effettivamente presenti." },
      ],
      afterTitle: "Che cosa succede al tuo riscontro",
      after: [
        { title: "Raccolto", copy: "Ogni valutazione viene salvata e collegata esattamente alla fermata che hai scelto." },
        { title: "Analizzato", copy: "Nel portale interno gli uffici competenti vedono tutti i voti, la dotazione e il tuo commento." },
        { title: "Migliorato", copy: "Così emerge dove mancano con più urgenza pensiline, illuminazione o accessibilità." },
      ],
      faqTitle: "Domande frequenti",
      faq: [
        { q: "Serve un account?", a: "No. Puoi valutare ogni fermata pubblicata senza registrarti." },
        { q: "Posso valutare più fermate?", a: "Sì. Valuta tutte le fermate che conosci: ogni riscontro viene salvato singolarmente." },
        { q: "La mia fermata non è sulla mappa.", a: "Sulla mappa compaiono solo le fermate pubblicate nel portale amministrativo. Se manca la tua, segnalala al Service Desk." },
        { q: "Che cosa succede al mio indirizzo e-mail?", a: "È facoltativo. Viene salvato solo se acconsenti espressamente al contatto ed è visibile esclusivamente agli uffici competenti." },
        { q: "In che lingua posso rispondere?", a: "In tedesco, italiano o inglese. La lingua scelta viene salvata insieme al tuo riscontro." },
      ],
      cta: "Cerca una fermata",
    },
    about: {
      eyebrow: "Il progetto", title: "Il progetto",
      lead: [
        "Con il progetto «Haltestellencheck» vogliamo coinvolgere attivamente i passeggeri nello sviluppo del trasporto pubblico in Alto Adige. Al centro ci sono le fermate degli autobus e le stazioni del trasporto pubblico locale, e la domanda di come le utenti e gli utenti vivano la sosta e l'esperienza sul posto.",
        "I passeggeri hanno la possibilità di condividere direttamente con noi la propria esperienza, di avanzare proposte di miglioramento concrete e di richiamare l'attenzione sugli aspetti positivi. Il riscontro dei passeggeri diventa così una parte importante del miglioramento continuo dell'offerta di trasporto pubblico.",
      ],
      sections: [
        {
          title: "Come funziona l'Haltestellencheck",
          body: [
            "Attraverso un sondaggio online i passeggeri possono valutare una fermata o una stazione che utilizzano. È possibile giudicare diversi aspetti della singola fermata, per esempio la dotazione, la pulizia, l'informazione, il comfort, l'accessibilità o l'aspetto generale.",
            "Oltre alla valutazione complessiva è possibile segnalare carenze concrete e margini di miglioramento. Allo stesso tempo i passeggeri possono mettere in evidenza le esperienze positive e segnalare gli elementi di dotazione che apprezzano particolarmente e che, a loro parere, sarebbero utili anche in altre fermate.",
            "L'Haltestellencheck non vuole quindi rendere visibili soltanto i problemi, ma raccogliere espressamente anche i buoni esempi e le esperienze positive. In questo modo i suggerimenti dei passeggeri possono contribuire ad applicare in futuro le soluzioni collaudate anche in altre località.",
          ],
        },
        {
          title: "Fasi di feedback periodiche",
          body: [
            "Il sondaggio online viene aperto in periodi stabiliti nel corso dell'anno. Al termine di ogni fase di feedback i riscontri pervenuti vengono raccolti e analizzati in modo sistematico.",
            "I risultati servono come base per individuare i problemi segnalati più di frequente, per esaminare le proposte di miglioramento e per ricavarne – ove possibile e sensato – misure concrete per migliorare le fermate e le stazioni, e per attuarle.",
            "Nasce così un ciclo continuo di feedback, analisi, miglioramento e nuova valutazione.",
          ],
        },
        {
          title: "Trasparenza grazie ai risultati in tempo reale",
          body: [
            "Un altro elemento importante del progetto è la trasparenza dei risultati. I passeggeri non possono soltanto esprimere la propria opinione, ma anche consultare le valutazioni e i risultati già pervenuti.",
            "In questo modo si fanno subito un'idea di come altri passeggeri valutino la stessa fermata o stazione. I risultati raccolti rendono così visibili percezioni differenti e offrono un ulteriore orientamento alle utenti e agli utenti.",
          ],
        },
        {
          title: "Sviluppare insieme il trasporto pubblico",
          body: [
            "L'Haltestellencheck crea un collegamento diretto tra le esperienze dei passeggeri e lo sviluppo del trasporto pubblico in Alto Adige. Le utenti e gli utenti non vengono intesi soltanto come passeggeri, ma come protagonisti attivi.",
            "Raccogliendo e analizzando i riscontri con continuità nasce un patrimonio di esperienze prezioso, che può contribuire a migliorare nel lungo periodo la qualità, la dotazione e la vivibilità delle fermate e delle stazioni.",
          ],
        },
      ],
      closing: "Perché chi usa il trasporto pubblico ogni giorno sa meglio di chiunque altro che cosa funziona sul posto – e dove c'è ancora margine di miglioramento.",
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
      lead: "This platform lets you rate the stops across South Tyrol from a passenger's point of view. You know your stop best: whether the shelter is missing, the lighting is too weak, or the timetable is unreadable.",
      copy: "No account needed. Your feedback goes straight to the people who plan public transport.",
      stepsTitle: "Four steps to your feedback",
      steps: [
        { title: "Pick a stop", copy: "Open the map on the home page and click a stop. Or find it under “Stops” by name, station or municipality." },
        { title: "Rate it", copy: "Give an overall mark from 1 to 5, then rate each area in turn, from cleanliness to accessibility." },
        { title: "Record the facilities", copy: "Note whether there is shelter, seating and lighting, and describe in the text field what should be improved." },
        { title: "Submit", copy: "No account, about two minutes. You can leave an email address if you are happy for us to follow up." },
      ],
      criteriaTitle: "What you can rate",
      criteriaCopy: "Every stop is rated in five areas on a scale of 1 to 5. On top of that you record what is actually there.",
      criteria: [
        { title: "Cleanliness", copy: "The state of the shelter, the bench and the surroundings: litter, dirt and damage." },
        { title: "Feeling of safety", copy: "How safe you feel while waiting, especially in the evening and through the dark months." },
        { title: "Accessibility", copy: "Step-free access, kerb height, tactile guidance and room for a wheelchair or pushchair." },
        { title: "Passenger information", copy: "Timetable, line numbers and real-time displays: present, up to date and easy to read?" },
        { title: "Weather protection", copy: "Shelter from rain, wind and sun. In summer, shade counts too." },
        { title: "Facilities", copy: "You also record whether shelter, seating and lighting are there at all." },
      ],
      afterTitle: "What happens to your feedback",
      after: [
        { title: "Collected", copy: "Every rating is stored and tied to exactly the stop you selected." },
        { title: "Reviewed", copy: "In the internal portal the responsible teams see every individual mark, the facilities and your comment." },
        { title: "Improved", copy: "That shows which stops most urgently lack shelter, lighting or step-free access." },
      ],
      faqTitle: "Frequently asked questions",
      faq: [
        { q: "Do I need an account?", a: "No. You can rate any published stop without signing up." },
        { q: "Can I rate more than one stop?", a: "Yes. Rate as many stops as you know — each piece of feedback is stored separately." },
        { q: "My stop is not on the map.", a: "Only stops published in the administration portal appear on the map. If yours is missing, report it through the service desk." },
        { q: "What happens to my email address?", a: "It is optional. It is only stored if you explicitly agree to be contacted, and it is visible only to the responsible teams." },
        { q: "Which language can I answer in?", a: "German, Italian or English. The language you choose is stored with your feedback." },
      ],
      cta: "Search for a stop",
    },
    about: {
      eyebrow: "About the project", title: "About the project",
      lead: [
        "With the “Haltestellencheck” project we want to involve passengers actively in the development of public transport in South Tyrol. At its centre are the bus stops and railway stations of local public transport, and the question of how the people who use them experience their time there.",
        "Passengers get the chance to share their personal experience directly with us, to put forward concrete suggestions for improvement and to draw attention to the positive aspects. Passenger feedback thereby becomes an important part of the continuous improvement of the public transport offering.",
      ],
      sections: [
        {
          title: "How the Haltestellencheck works",
          body: [
            "Through an online survey, passengers can rate a stop or station they use. Various aspects of the individual stop can be assessed, for example its facilities, cleanliness, information, comfort, accessibility or its general appearance.",
            "Alongside the overall rating there is also the option to report specific shortcomings and room for improvement. At the same time passengers can highlight positive experiences and point out features they particularly value and which, in their view, would make sense at other stops too.",
            "The Haltestellencheck is therefore not only meant to make problems visible, but expressly to capture good examples and positive experiences as well. In this way passengers' suggestions can help to apply proven solutions at other locations in future.",
          ],
        },
        {
          title: "Regular feedback phases",
          body: [
            "The online survey opens for set periods over the course of the year. At the end of each feedback phase, the responses received are collected and evaluated systematically.",
            "The results serve as a basis for identifying frequently reported problems, for examining suggested improvements and — where it is possible and sensible — for deriving concrete measures to improve the stops and stations, and putting them into practice.",
            "This creates a continuous cycle of feedback, analysis, improvement and renewed assessment.",
          ],
        },
        {
          title: "Transparency through real-time results",
          body: [
            "Another important part of the project is the transparency of the results. Passengers can not only give their own opinion, but also view the ratings and results already received.",
            "That gives them an immediate impression of how other passengers rate the same stop or station. The collected results thus make differing perceptions visible and offer users additional orientation.",
          ],
        },
        {
          title: "Developing public transport together",
          body: [
            "The Haltestellencheck creates a direct link between passengers' experiences and the development of public transport in South Tyrol. Users are understood not merely as passengers, but as active contributors.",
            "By collecting and evaluating the responses continuously, a valuable body of experience emerges that can help to improve the quality, the facilities and the comfort of stops and stations in the long term.",
          ],
        },
      ],
      closing: "Because the people who use public transport every day know best what works on the ground — and where there is still room for improvement.",
      tagline: "For the people who keep South Tyrol moving every day.", cta: "Give feedback now",
    },
    footer: { note: "A project for local public transport in South Tyrol.", links: ["Imprint", "Privacy", "Accessibility", "Contact"] },
  },
} as const;
