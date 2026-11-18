"use client";
import { useState } from "react";
/** Derive offset for the selected date (including daylight-saving changes). */
export function LocalDateFields({
  cleanup = false,
  labels,
}: {
  cleanup?: boolean;
  labels: { start: string; end: string; timezone: string };
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const offset = (value: string) =>
    value
      ? new Date(value).getTimezoneOffset()
      : new Date().getTimezoneOffset();
  return (
    <>
      <input type="hidden" name="timezone_offset" value={offset(start)} />
      <div className="field-grid">
        <label>
          {labels.start}
          <input
            type="datetime-local"
            name={cleanup ? "scheduled_at" : "starts_at"}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required={cleanup}
          />
        </label>
        {!cleanup ? (
          <label>
            {labels.end}
            <input
              type="datetime-local"
              name="ends_at"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        ) : null}
      </div>
      {!cleanup ? (
        <input type="hidden" name="ends_at_offset" value={offset(end)} />
      ) : null}
      <small>
        {labels.timezone}: {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </small>
    </>
  );
}
