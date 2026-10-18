type StopPage<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

/** Fetch beyond PostgREST's server-side row cap, including caps below our page size. */
export async function loadPublishedStopPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<StopPage<T>>,
): Promise<T[]> {
  const stops: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(stops.length, stops.length + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) return stops;
    stops.push(...data);
    if (count !== null && stops.length >= count) return stops;
  }
}
