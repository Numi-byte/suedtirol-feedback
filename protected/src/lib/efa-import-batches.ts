import type { EfaStopPlace } from "./efa-stop-places";

type WriteBatch = (rows: EfaStopPlace[]) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Recover only from diagnosed row conflicts. Auth/network/schema failures stop the import. */
export async function importEfaBatches(rows: EfaStopPlace[], write: WriteBatch,
  onImported: (count: number) => void, errors: string[]) {
  async function save(batch: EfaStopPlace[]) {
    const response = await write(batch);
    if (response.error) return response.error.message;
    if (!Number.isInteger(response.data) || response.data !== batch.length) {
      throw new Error("The database returned an invalid EFA import count.");
    }
    onImported(batch.length);
    return null;
  }
  const isConflict = (message: string) => /Multiple existing stops match EFA|Conflicting source identity|duplicate key value violates unique constraint/.test(message);
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    const error = await save(batch);
    if (!error) continue;
    if (!isConflict(error)) throw new Error(error);
    // A failed RPC rolls back the entire batch. Retry its rows individually so
    // one existing conflict cannot prevent unrelated stops or later batches.
    for (const row of batch) {
      const rowError = await save([row]);
      if (!rowError) continue;
      if (!isConflict(rowError)) throw new Error(rowError);
      errors.push(`${row.id_version}: ${rowError}`);
    }
  }
}
