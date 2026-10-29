import type {
  HealthResponse,
  IndustrialEvent,
  MetricsResponse,
  Observation,
  Percentiles,
  SourceHealth,
  SourceMetrics,
} from "./types";

// Remove slash at the end if there's any
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Runtime guards for untrusted JSON payloads returned by the CV service.
 * These prevent malformed responses from being silently treated as valid UI data.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid API response: "${field}" must be a string.`);
  }
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid API response: "${field}" must be a finite number.`);
  }
  return value;
}

function parseNullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return requiredNumber(value, field);
}

function parseEvent(value: unknown): IndustrialEvent {
  if (!isRecord(value) || !isRecord(value.result)) {
    throw new Error("Invalid API response: event must contain an object result.");
  }
  const evidencePath = value.evidence_path;
  const evidenceClip = value.evidence_clip;
  if (evidencePath !== null && typeof evidencePath !== "string") {
    throw new Error('Invalid API response: "evidence_path" must be a string or null.');
  }
  if (evidenceClip !== null && typeof evidenceClip !== "string") {
    throw new Error('Invalid API response: "evidence_clip" must be a string or null.');
  }
  return {
    event_id: requiredString(value.event_id, "event_id"),
    source_id: requiredString(value.source_id, "source_id"),
    event_type: requiredString(value.event_type, "event_type"),
    occurred_at: requiredString(value.occurred_at, "occurred_at"),
    created_at: requiredString(value.created_at, "created_at"),
    result: value.result,
    evidence_path: evidencePath,
    evidence_clip: evidenceClip,
  };
}

function parseHealthSource(value: unknown): SourceHealth {
  if (!isRecord(value)) throw new Error("Invalid API response: source health must be an object.");
  if (typeof value.healthy !== "boolean") {
    throw new Error('Invalid API response: "healthy" must be a boolean.');
  }
  const lastError = value.last_error;
  if (lastError !== null && typeof lastError !== "string") {
    throw new Error('Invalid API response: "last_error" must be a string or null.');
  }
  return {
    source_id: requiredString(value.source_id, "source_id"),
    uri: requiredString(value.uri, "uri"),
    state: requiredString(value.state, "state"),
    healthy: value.healthy,
    fps: requiredNumber(value.fps, "fps"),
    processing_fps: requiredNumber(value.processing_fps, "processing_fps"),
    frames_received: requiredNumber(value.frames_received, "frames_received"),
    frames_dropped: requiredNumber(value.frames_dropped, "frames_dropped"),
    buffered: requiredNumber(value.buffered, "buffered"),
    reconnects: requiredNumber(value.reconnects, "reconnects"),
    last_error: lastError,
    last_frame_age_s: parseNullableNumber(value.last_frame_age_s, "last_frame_age_s"),
  };
}

/**
 * Parses success and inference-error observations without treating failures as empty detections.
 * @param sourceId Map key from GET /observations.
 * @param value Raw observation payload from the API.
 * @returns A validated observation for dashboard rendering.
 */
function parseObservation(sourceId: string, value: unknown): Observation {
  if (!isRecord(value)) throw new Error(`Invalid observation for source "${sourceId}".`);
  const status = requiredString(value.status, "status");
  if (status === "error") {
    return {
      source_id: requiredString(value.source_id, "source_id"),
      status,
      measured_at: typeof value.measured_at === "string" ? value.measured_at : undefined,
      error: typeof value.error === "string" ? value.error : "Inference failed.",
    };
  }
  const counts: Record<string, number> = {};
  if (isRecord(value.counts)) {
    for (const [label, count] of Object.entries(value.counts)) {
      counts[label] = requiredNumber(count, `counts.${label}`);
    }
  }
  const tracks: Observation["tracks"] = Array.isArray(value.tracks)
    ? value.tracks.map((track) => {
        if (!isRecord(track) || !Array.isArray(track.bbox) || !Array.isArray(track.zones)) {
          throw new Error(`Invalid track in observation for source "${sourceId}".`);
        }
        return {
          track_id: requiredNumber(track.track_id, "track_id"),
          class: requiredString(track.class, "class"),
          confidence: requiredNumber(track.confidence, "confidence"),
          bbox: track.bbox.map((coordinate) => requiredNumber(coordinate, "bbox")),
          zones: track.zones.map((zone) => requiredString(zone, "zones[]")),
        };
      })
    : [];
  return {
    source_id: requiredString(value.source_id, "source_id"),
    status,
    seq: typeof value.seq === "number" ? value.seq : undefined,
    measured_at: typeof value.measured_at === "string" ? value.measured_at : undefined,
    counts,
    tracks,
    infer_ms: typeof value.infer_ms === "number" ? value.infer_ms : undefined,
    latency_ms: typeof value.latency_ms === "number" ? value.latency_ms : undefined,
  };
}

function parsePercentiles(value: unknown, field: string): Percentiles {
  if (!isRecord(value)) throw new Error(`Invalid API response: "${field}" must be an object.`);
  return {
    p50: parseNullableNumber(value.p50, `${field}.p50`),
    p95: parseNullableNumber(value.p95, `${field}.p95`),
    max: parseNullableNumber(value.max, `${field}.max`),
  };
}

/**
 * Parses source metrics, including the dynamic event-type counter map.
 * @param value Raw source metrics payload.
 * @returns A typed metrics record with validated counters and percentiles.
 */
function parseMetricsSource(value: unknown): SourceMetrics {
  if (!isRecord(value) || !isRecord(value.events)) {
    throw new Error("Invalid API response: source metrics must be an object.");
  }
  const events: Record<string, number> = {};
  for (const [eventType, count] of Object.entries(value.events)) {
    events[eventType] = requiredNumber(count, `events.${eventType}`);
  }
  return {
    source_id: requiredString(value.source_id, "source_id"),
    uptime_s: requiredNumber(value.uptime_s, "uptime_s"),
    frames_received: requiredNumber(value.frames_received, "frames_received"),
    frames_processed: requiredNumber(value.frames_processed, "frames_processed"),
    frames_dropped: requiredNumber(value.frames_dropped, "frames_dropped"),
    drop_rate: parseNullableNumber(value.drop_rate, "drop_rate"),
    input_fps: requiredNumber(value.input_fps, "input_fps"),
    processing_fps: requiredNumber(value.processing_fps, "processing_fps"),
    infer_ms: parsePercentiles(value.infer_ms, "infer_ms"),
    latency_ms: parsePercentiles(value.latency_ms, "latency_ms"),
    reconnects: requiredNumber(value.reconnects, "reconnects"),
    inference_errors: requiredNumber(value.inference_errors, "inference_errors"),
    events,
    clips_written: requiredNumber(value.clips_written, "clips_written"),
    clips_failed: requiredNumber(value.clips_failed, "clips_failed"),
  };
}

/**
 * Performs a bounded JSON request and converts transport failures into operator-readable errors.
 * The timeout is always cleared, including on HTTP, parsing, and network failures.
 * @param path API path relative to the configured base URL.
 * @returns Untrusted JSON value for endpoint-specific parsing.
 */
async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    return await response.json() as unknown;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach API at ${API_BASE_URL}. Check that the CV service is running.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  const value = await getJson("/health");
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    throw new Error("Invalid API response from /health.");
  }
  return {
    time: requiredString(value.time, "time"),
    sources: value.sources.map(parseHealthSource),
  };
}

export async function fetchObservations(): Promise<Record<string, Observation>> {
  const value = await getJson("/observations");
  if (!isRecord(value)) throw new Error("Invalid API response from /observations.");
  return Object.fromEntries(
    Object.entries(value).map(([sourceId, observation]) => [
      sourceId,
      parseObservation(sourceId, observation),
    ]),
  );
}

export async function fetchEvents(limit = 100): Promise<IndustrialEvent[]> {
  const value = await getJson(`/events?limit=${limit}`);
  if (!Array.isArray(value)) throw new Error("Invalid API response from /events.");
  return value.map(parseEvent);
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const value = await getJson("/metrics");
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    throw new Error("Invalid API response from /metrics.");
  }
  return {
    time: requiredString(value.time, "time"),
    sources: value.sources.map(parseMetricsSource),
  };
}

export function evidenceUrl(relativePath: string | null): string | null {
  if (!relativePath) return null;
  const fileName = relativePath.split(/[\\/]/).at(-1);
  if (!fileName) return null;
  return `${API_BASE_URL}/evidence/${encodeURIComponent(fileName)}`;
}

export function snapshotUrl(sourceId: string, refreshKey: number): string {
  return `${API_BASE_URL}/snapshot/${encodeURIComponent(sourceId)}.jpg?t=${refreshKey}`;
}

export const apiBaseUrl = API_BASE_URL;
