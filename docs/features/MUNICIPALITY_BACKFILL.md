# Fill missing stop municipalities

Apply `supabase/migrations/20261110120000_fill_missing_stop_municipalities.sql` before deploying the updated protected app. No hosted database rows or migrations were changed during implementation. The new generated flag/index identifies empty or whitespace-only German/Italian municipality fields. The two new RPCs require **Datenbank verwalten** permission; import-only and anonymous accounts cannot use them.

At the bottom of **Datenbank verwalten**:

- **Nur fehlende Gemeinden anzeigen** filters both the active list and archived list. Search terms are retained; switching the filter resets pagination. The filter remains in the URL while selecting and saving stops.
- **Gemeinden aus EFA ergänzen** scans every missing record, including archives and records outside the current search/page. It fetches the supplied EFA stop list once, builds verified candidates, then saves sequential batches of at most 250 with progress and a downloadable review report.

The workflow does not create, publish, archive, delete or rename stops, assign coordinates, or overwrite existing translations. Saved batches remain saved if a later request fails; retries only process the remaining missing fields. Each batch locks/checks its current rows again before filling blanks. A concurrent manual edit or changed source ID is preserved. The legacy `municipality` display field is filled only if it was also empty; existing legacy text remains intact. Public map data uses its existing cache expiry.

## Resolve the comune, not the frazione

The stored full source reference, e.g. `(it:apb:StopPlace:it:22021:2553,any)`, must match the complete EFA `id`. No partial suffix, stop number, coordinates or guessed name match is used.

EFA `parent.name` can describe a frazione. Its `parent.properties.omc` identifies the municipality: `22` + the six-digit ISTAT municipality code. The bundled ANPR reference resolves that code to the official Italian and second-language German names. Examples verified from the source data:

| EFA parent | OMC | Italian comune | German Gemeinde |
| --- | --- | --- | --- |
| Merano | 22021051 | Merano | Meran |
| Resia (Curon Venosta) | 22021027 | Curon Venosta | Graun im Vinschgau |
| Anterselva (Rasun Anterselva) | 22021071 | Rasun-Anterselva | Rasen-Antholz |
| Termeno sulla Strada del Vino | 22021098 | Termeno sulla strada del vino | Tramin an der Weinstraße |

The EFA stop-finder German response is **not** used as the translation authority. During research one exact Termeno lookup returned “Neumarkt,” and other responses used fractions or shortened names such as “Welsberg” instead of the full comune “Welsberg-Taisten.” ANPR supplies the administrative names instead.

Unknown or conflicting codes, absent full EFA IDs, unmatched stops and incompatible partial translations are not guessed. They remain unchanged and enter the report. One observed EFA row had `22014009`, outside South Tyrol; this is deliberately outside the 116-municipality reference rather than being assigned a South Tyrol comune.

## Sources and attribution

Names and administrative codes: **ANPR — Anagrafe Nazionale della Popolazione Residente**, official public archive, **CC BY 4.0**:

- [Municipality archive](https://github.com/italia/anpr/blob/master/src/archivi/ANPR_archivio_comuni.csv)
- [Archive legend and license](https://github.com/italia/anpr/blob/master/src/archivi/ANPR_archivio_comuni_legenda.md)
- [Raw CSV](https://raw.githubusercontent.com/italia/anpr/master/src/archivi/ANPR_archivio_comuni.csv)

`DENOMINAZIONE_IT` is the official Italian denomination; `ALTRADENOMINAZIONE` is the second official-language denomination. Only South Tyrol rows with `STATO=A` and `DATACESSAZIONE=9999-12-31` are included (116 unique codes). Uppercase source names are normalized to display casing without translating words. The JSON stores the retrieval-check date, source-file SHA-256, ANPR row IDs, source update dates and attribution. Source update dates are distinct from the date the snapshot was checked.

The code-join was checked against the live EFA feed provided by the owner. The official ANPR legend and actual Merano/Curon/Rasun/Termeno rows were also inspected in Chromium with TLS verification enabled. Shared Chrome could not start in this environment (`BROWSER_CONFIG_AUTH_TOKEN` missing; desktop capability/control tool unavailable), so these browser checks used local Chromium. No browser profile or credential files were accessed. Additional province-reference domain proposals were removed from the environment draft after the official ANPR repository proved accessible on already-permitted GitHub; no additional domains are needed for the application feature.

To refresh the bundled reference, download the official raw CSV with normal TLS verification, review the active rows and source license, then run:

```sh
python3 protected/scripts/update-municipality-reference.py /path/to/ANPR_archivio_comuni.csv --verified-at YYYY-MM-DD
```

The generator rejects incomplete or duplicate coverage. Review the resulting reference changes and rerun the tests before deployment. It does not modify a database.

## Review report

The JSON report contains stop UUIDs, full source IDs, stop names when available, and reasons such as:

- `no_complete_efa_place_id`, `stop_not_found_in_efa`: requires a reliable source link/manual review.
- `unknown_or_conflicting_municipality`: source metadata is missing, outside the verified province, or contradictory.
- `existing_translation_conflicts_with_reference` / `existing_translation_conflict`: existing text was preserved.
- `source_changed`, `stop_not_found`: record changed after the scan.
- `already_complete`: another edit already completed the record; no corrective action is needed.

No report contains feedback, email addresses or other private submission data.

## Checks

Node regressions cover all 116 official reference entries, Merano, frazioni, full compound names, similarly prefixed stop IDs, malformed/conflicting duplicates, existing translations and incomplete feeds. Disposable PostgreSQL tests cover keyset paging, role permissions, whitespace, exact source matching, archived rows, preserved data and idempotency. The browser regression uses a local EFA fixture and exercises the bottom-of-page action, a server row cap smaller than the requested page, records outside the visible list, archives, remaining-gap filtering and repeat runs without losing URL context. It never fills the live database.

Read-only evaluation of the captured 2026-11-10 EFA response found 3,295 unique `it:22021:` stop IDs: 3,294 resolve to the official reference, and `it:22021:84` (Passo Stelvio, outside-province OMC `22014009`) remains for review. These are feed coverage counts, not claims about how many database records need updates.
