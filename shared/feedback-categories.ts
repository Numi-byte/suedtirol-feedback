/** The issue wording shown to passengers and portal staff. */
export const feedbackCategoryLabels = {
  "de": {
    "weather_protection": "Witterungsschutz fehlt",
    "seating": "Sitzplatz fehlt",
    "safe_sidewalk": "Sicherer Gehweg zur Haltestelle fehlt",
    "safe_crossing": "Keine sichere Querung der Straße zur Haltestelle",
    "passenger_information": "Fahrgastinformation fehlt oder ist mangelhaft",
    "lighting": "Beleuchtung fehlt",
    "accessibility": "Barrierefreiheit nicht gegeben",
    "shading": "Beschattung fehlt",
    "bicycle_parking": "Fahrradabstellplatz fehlt",
    "waste_bin": "Mülleimer fehlt"
  },
  "it": {
    "weather_protection": "Manca la protezione dalle intemperie",
    "seating": "Mancano posti a sedere",
    "safe_sidewalk": "Manca un percorso pedonale sicuro verso la fermata",
    "safe_crossing": "Manca un attraversamento stradale sicuro verso la fermata",
    "passenger_information": "Le informazioni ai passeggeri sono assenti o insufficienti",
    "lighting": "Manca l’illuminazione",
    "accessibility": "L’accessibilità non è garantita",
    "shading": "Manca l’ombra",
    "bicycle_parking": "Mancano parcheggi per biciclette",
    "waste_bin": "Manca un cestino dei rifiuti"
  },
  "en": {
    "weather_protection": "Weather protection is missing",
    "seating": "Seating is missing",
    "safe_sidewalk": "A safe footpath to the stop is missing",
    "safe_crossing": "A safe road crossing to the stop is missing",
    "passenger_information": "Passenger information is missing or inadequate",
    "lighting": "Lighting is missing",
    "accessibility": "Accessibility is inadequate",
    "shading": "Shade is missing",
    "bicycle_parking": "Bicycle parking is missing",
    "waste_bin": "A waste bin is missing"
  }
};

export type FeedbackCategorySlug = keyof typeof feedbackCategoryLabels.de;
