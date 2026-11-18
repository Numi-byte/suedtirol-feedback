/** Keep the database's list context when opening, creating or closing an editor. */
export function databaseSelectionHref(search: string, stopId: string | null): string {
  const params = new URLSearchParams(search);
  if (stopId) params.set("stop", stopId);
  else params.delete("stop");
  return `/database${params.size ? `?${params}` : ""}`;
}

export type StopMutationResult = {
  success?: boolean;
  error?: string;
  createdId?: string;
  archivedId?: string;
};
