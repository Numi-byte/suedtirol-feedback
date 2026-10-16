/** PostgREST caps response sizes independently of the requested range. */
export async function loadAllStopRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{
  data: T[] | null; error: { message: string } | null; count: number | null;
}>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + 499);
    if (error) throw new Error(`Could not load stop places: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
    if (count !== null && rows.length >= count) return rows;
  }
}
