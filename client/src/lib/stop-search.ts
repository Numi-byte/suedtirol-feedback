/** Search aliases are transient: stored names and displayed content remain intact. */
export function normalizeStopSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
type Point = { name_de: string; name_it: string; point_number: string };
type Place = {
  name_de: string;
  name_it: string;
  name_en: string;
  municipality?: string;
  municipality_de?: string;
  municipality_it?: string;
  point_search?: Point[];
};
type Entry<T> = {
  value: T;
  names: string[];
  pointNames: string[];
  words: string[];
  contexts: string[][];
};
const aliases: Record<string, string> = {
  bf: "bahnhof",
  hbf: "hauptbahnhof",
  staz: "stazione",
};
const words = (value: string) =>
  normalizeStopSearch(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => aliases[word] ?? word);
function closeWord(a: string, b: string): boolean {
  // A single typo (including swapped neighbours), only in reasonably long words.
  if (
    a.length < 5 ||
    b.length < 5 ||
    Math.abs(a.length - b.length) > 1 ||
    /\d/.test(a + b)
  )
    return false;
  if (a.length === b.length) {
    const different = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different.push(i);
    return (
      different.length === 1 ||
      (different.length === 2 &&
        different[1] === different[0] + 1 &&
        a[different[0]] === b[different[1]] &&
        a[different[1]] === b[different[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0,
    j = 0,
    skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}
export function buildStopSearch<T extends Place>(
  places: T[],
  language: "de" | "it" | "en",
): Entry<T>[] {
  return places.map((value) => {
    const names = [
      value[`name_${language}`],
      value.name_de,
      value.name_it,
      value.name_en,
    ]
      .filter(Boolean)
      .map(normalizeStopSearch);
    const base = words(
      [
        value.name_de,
        value.name_it,
        value.name_en,
        value.municipality_de,
        value.municipality_it,
        value.municipality,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return {
      value,
      names,
      pointNames: (value.point_search ?? [])
        .flatMap((p) => [p.name_de, p.name_it])
        .filter(Boolean)
        .map(normalizeStopSearch),
      words: base,
      contexts: [
        base,
        ...(value.point_search ?? []).map((p) => [
          ...base,
          ...words(`${p.name_de} ${p.name_it} ${p.point_number}`),
        ]),
      ],
    };
  });
}
export function searchStopIndex<T>(entries: Entry<T>[], query: string): T[] {
  const terms = words(query);
  if (!terms.length) return entries.map((entry) => entry.value);
  // Bound per-keystroke work; retain normal results for practical queries.
  if (terms.length > 24 || query.length > 256) return [];
  const phrase = normalizeStopSearch(query),
    compact = phrase.replace(/ /g, "");
  const score = (entry: Entry<T>): number => {
    let best = Infinity;
    for (const context of entry.contexts) {
      let cost = 0;
      for (const term of terms) {
        if (context.includes(term)) continue;
        if (context.some((word) => word.startsWith(term))) {
          cost += 2;
          continue;
        }
        if (context.some((word) => word.includes(term))) {
          cost += 4;
          continue;
        }
        if (context.join("").includes(term)) {
          cost += 5;
          continue;
        }
        if (context.some((word) => closeWord(term, word))) {
          cost += 12;
          continue;
        }
        cost = Infinity;
        break;
      }
      best = Math.min(best, cost);
    }
    const exact = entry.names.findIndex((name) => name === phrase);
    if (exact >= 0) return exact === 0 ? -100 : -90;
    if (entry.names.some((name) => name.replace(/ /g, "") === compact))
      return -80;
    if (!Number.isFinite(best)) return best;
    if (entry.pointNames.includes(phrase)) return -60;
    if (entry.names.some((name) => name.startsWith(phrase))) return best - 30;
    if (entry.names.some((name) => name.includes(phrase))) return best - 20;
    return best;
  };
  return entries
    .map((entry, index) => ({ entry, index, score: score(entry) }))
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((row) => row.entry.value);
}

/** Preserve every boarding point; put relevant ones first when a place is opened. */
export function rankStopPoints<T extends Point>(
  points: T[],
  query: string,
  language: "de" | "it" | "en",
): T[] {
  const terms = words(query);
  if (!terms.length || query.length > 256 || terms.length > 24) return points;
  return points
    .map((point, index) => {
      const primary = normalizeStopSearch(
        language === "de" ? point.name_de : point.name_it,
      );
      const tokens = words(
        `${point.name_de} ${point.name_it} ${point.point_number}`,
      );
      const score =
        terms.reduce(
          (sum, term) =>
            sum +
            (tokens.includes(term)
              ? 4
              : tokens.some((word) => word.startsWith(term))
                ? 3
                : tokens.some((word) => word.includes(term))
                  ? 2
                  : tokens.some((word) => closeWord(term, word))
                    ? 1
                    : 0),
          0,
        ) + (primary === normalizeStopSearch(query) ? 100 : 0);
      return { point, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.point);
}
