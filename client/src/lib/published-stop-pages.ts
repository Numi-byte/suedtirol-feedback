type StopPage<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

/** Fetch beyond PostgREST's server-side row cap, including caps below our page size. */
export async function loadPublishedStopPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<StopPage<T>>,
): Promise<T[]> {
  const stops: T[] = [];
  const deadline = Date.now() + 30_000;
  for (let page = 0; page < 1000 && Date.now() < deadline; page++) {
    const { data, error, count } = await fetchPage(stops.length, stops.length + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) {
      if (count !== null && stops.length < count) throw new Error("Published stop data is incomplete.");
      return stops;
    }
    if (stops.length + data.length > 100_000) throw new Error("Published stop result limit exceeded.");
    stops.push(...data);
    if (count !== null && stops.length >= count) return stops;
  }
  throw new Error("Published stop request exceeded its time or page limit.");
}
