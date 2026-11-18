import reference from "./municipality-reference.json" with { type: "json" };
/** Official ANPR names keyed by EFA OMC (22 + the six-digit ISTAT code). */
export const municipalityByOmc = new Map(reference.municipalities.map(row => [row.omc, row]));
export const municipalityReferenceDate = reference.verifiedAt;
