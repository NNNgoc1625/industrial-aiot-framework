export type ValidationProfile = "auto" | "events" | "sensors";
export type DetectedProfile = "events" | "sensors" | "generic";

export interface ValidationIssue {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  fileName: string;
  profile: DetectedProfile;
  totalRows: number;
  validRows: number;
  issues: ValidationIssue[];
  columns: string[];
  preview: Array<Record<string, unknown>>;
}

const EVENT_FIELDS = ["event_id", "source_id", "event_type", "occurred_at", "created_at", "result"];
const SENSOR_FIELDS = ["source_id", "measured_at", "received_at", "quality"];
const EVENT_TYPES = new Set(["zone_intrusion", "source_offline", "source_recovered", "source_ended"]);
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses CSV with quoted cells, escaped quotes, and CRLF line endings.
 * Also decodes the event result column when it contains valid JSON.
 * @param text Raw CSV file contents.
 * @returns Parsed records with normalized headers.
 */
function parseCsv(text: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) throw new Error("The selected CSV file is empty.");

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  if (headers.some((header) => header.length === 0)) {
    throw new Error("CSV headers cannot be empty.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate column names.");
  }
  return rows.slice(1).map((values, index) => {
    if (values.length > headers.length) {
      throw new Error(`CSV row ${index + 2} has more values than headers.`);
    }
    const record: Record<string, unknown> = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? ""]),
    );
    if (typeof record.result === "string" && record.result.trim() !== "") {
      try {
        record.result = JSON.parse(record.result) as unknown;
      } catch {
        // Keep invalid JSON as text so the event validator can report the result field.
      }
    }
    return record;
  });
}

/**
 * Parses one JSON value per non-empty line while keeping source line numbers in errors.
 * @param text Raw JSONL or NDJSON file contents.
 * @returns Parsed values in file order.
 */
function parseJsonLines(text: string): unknown[] {
  const rows: unknown[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line) as unknown);
    } catch {
      throw new Error(`Invalid JSON on line ${index + 1}.`);
    }
  }
  return rows;
}

function parseJson(text: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The selected JSON file is not valid JSON.");
  }
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed)) return [parsed];
  throw new Error("JSON must contain an object or an array of objects.");
}

function detectProfile(rows: unknown[], requested: ValidationProfile): DetectedProfile {
  if (requested === "events") return "events";
  if (requested === "sensors") return "sensors";
  const first = rows.find(isRecord);
  if (!first) return "generic";
  if ("event_id" in first || "event_type" in first) return "events";
  if ("measured_at" in first || "received_at" in first) return "sensors";
  return "generic";
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Applies profile-specific schema checks and detects duplicate record identities.
 * Row numbers are one-based relative to data records, excluding a CSV header.
 * @param rows Parsed records to validate.
 * @param profile Schema profile selected or inferred for the file.
 * @returns All validation issues found in the records.
 */
function validateRows(rows: unknown[], profile: DetectedProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredFields = profile === "events" ? EVENT_FIELDS : profile === "sensors" ? SENSOR_FIELDS : [];
  const identities = new Set<string>();

  rows.forEach((value, index) => {
    const rowNumber = index + 1;
    if (!isRecord(value)) {
      issues.push({ row: rowNumber, field: "row", message: "Record must be a JSON object." });
      return;
    }
    for (const field of requiredFields) {
      if (isMissing(value[field])) {
        issues.push({ row: rowNumber, field, message: `Required field "${field}" is missing.` });
      }
    }

    const timestampFields = profile === "events"
      ? ["occurred_at", "created_at"]
      : profile === "sensors" ? ["measured_at", "received_at"] : [];
    for (const field of timestampFields) {
      if (!isMissing(value[field]) && (typeof value[field] !== "string" || !isIsoTimestamp(value[field]))) {
        issues.push({ row: rowNumber, field, message: `"${field}" must be a valid ISO-8601 timestamp.` });
      }
    }

    if (profile === "events") {
      if (!isMissing(value.event_type) && typeof value.event_type === "string" && !EVENT_TYPES.has(value.event_type)) {
        issues.push({ row: rowNumber, field: "event_type", message: `Unknown event type "${value.event_type}".` });
      }
      if (!isMissing(value.result) && !isRecord(value.result)) {
        issues.push({ row: rowNumber, field: "result", message: '"result" must be a JSON object.' });
      }
    }

    const identity = profile === "events" && typeof value.event_id === "string"
      ? `event:${value.event_id}`
      : profile === "sensors" && typeof value.source_id === "string" && typeof value.measured_at === "string"
        ? `sensor:${value.source_id}:${value.measured_at}`
        : null;
    if (identity) {
      if (identities.has(identity)) {
        issues.push({ row: rowNumber, field: profile === "events" ? "event_id" : "measured_at", message: "Duplicate record identity." });
      }
      identities.add(identity);
    }
  });
  return issues;
}

/**
 * Reads a supported local file, parses it, selects a schema, and builds its validation report.
 * No file contents are uploaded; oversized and malformed inputs are rejected explicitly.
 * @param file User-selected CSV, JSON, JSONL, or NDJSON file.
 * @param requestedProfile Explicit schema or automatic profile detection.
 * @returns Row counts, validation issues, columns, and a small preview.
 */
export async function validateFile(file: File, requestedProfile: ValidationProfile): Promise<ValidationResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds the 10 MB limit. Split it into smaller files and retry.");
  }
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const text = await file.text();
  let rows: unknown[];
  if (extension === "csv") {
    rows = parseCsv(text);
  } else if (extension === "jsonl" || extension === "ndjson") {
    rows = parseJsonLines(text);
  } else if (extension === "json") {
    rows = parseJson(text);
  } else {
    throw new Error("Unsupported file type. Choose CSV, JSON, JSONL, or NDJSON.");
  }
  if (rows.length === 0) throw new Error("The selected file contains no data records.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`File contains more than ${MAX_ROWS.toLocaleString()} records.`);
  }

  const profile = detectProfile(rows, requestedProfile);
  const issues = validateRows(rows, profile);
  const firstRecord = rows.find(isRecord);
  const columns = firstRecord ? Object.keys(firstRecord) : [];
  const invalidRows = new Set(issues.map((issue) => issue.row));
  return {
    fileName: file.name,
    profile,
    totalRows: rows.length,
    validRows: Math.max(rows.length - invalidRows.size, 0),
    issues,
    columns,
    preview: rows.filter(isRecord).slice(0, 5),
  };
}

export function createReportDownload(result: ValidationResult): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.fileName}.validation-report.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
