type QueryError = { message: string; code?: string };
type PageResult<T> = { data: T[] | null; count: number | null; error: QueryError | null };

export function requestedPage(value?: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= Math.floor(Number.MAX_SAFE_INTEGER / 10) ? page : 1;
}

/** Normal navigation reads one bounded page, never the entire table. */
export async function loadPortalPage<T>(page: number, size: number,
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  fetchCount: () => PromiseLike<{ count: number | null; error: QueryError | null }>,
) {
  let result = await fetchPage((page - 1) * size, page * size - 1);
  let count = result.count;
  // PostgREST can reject an offset beyond the last row instead of returning []
  // (for example after a reply moves the final report out of the active filter).
  if (result.error?.code === "PGRST103") {
    const total = await fetchCount();
    if (total.error) throw new Error(total.error.message);
    count = total.count;
  } else if (result.error) throw new Error(result.error.message);
  if (count === null) throw new Error("The database did not return a pagination count.");
  const pageCount = Math.max(1, Math.ceil(count / size));
  const currentPage = Math.min(page, pageCount);
  if (currentPage !== page) result = await fetchPage((currentPage - 1) * size, currentPage * size - 1);
  if (result.error) throw new Error(result.error.message);
  return { rows: result.data ?? [], count, pageCount, currentPage };
}

/** Match every word against any name, municipality or stop code. Quotes and
 * LIKE metacharacters are literals, never PostgREST filter syntax. */
export function stopSearchFilter(search: string): string | null {
  const columns = ["name_de", "name_it", "name_en", "municipality", "stop_code"];
  const terms = search.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  const clauses = terms.map(term => {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    return `or(${columns.map(column => `${column}.ilike.${quoted}`).join(",")})`;
  });
  return `and(${clauses.join(",")})`;
}
