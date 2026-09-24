/**
 * Export formats the browser is allowed to ask for.
 *
 * Duplicated from the API's own list rather than imported: this is a boundary
 * check on a query parameter, and it has to hold even if the API's constants
 * move or the request never reaches it.
 */
export const EXPORT_FORMATS = ["csv", "tsv"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: unknown): value is ExportFormat {
  return (
    typeof value === "string" &&
    (EXPORT_FORMATS as readonly string[]).includes(value)
  );
}
