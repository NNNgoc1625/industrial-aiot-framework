/**
 * Frontend DTOs mirror the current aiot-stream-cv HTTP contract.
 * Keep these shapes aligned with docs/data-contract.md when the backend contract changes.
 */
export interface IndustrialEvent {
  event_id: string;
  source_id: string;
  event_type: string;
  occurred_at: string;
  created_at: string;
  result: Record<string, unknown>;
  evidence_path: string | null;
  evidence_clip: string | null;
}

export interface SourceHealth {
  source_id: string;
  uri: string;
  state: string;
  healthy: boolean;
  fps: number;
  processing_fps: number;
  frames_received: number;
  frames_dropped: number;
  buffered: number;
  reconnects: number;
  last_error: string | null;
  last_frame_age_s: number | null;
}

export interface Track {
  track_id: number;
  class: string;
  confidence: number;
  bbox: number[];
  zones: string[];
}

export interface Observation {
  source_id: string;
  status: "ok" | "error" | string;
  seq?: number;
  measured_at?: string;
  counts?: Record<string, number>;
  tracks?: Track[];
  infer_ms?: number;
  latency_ms?: number;
  error?: string;
}

export interface Percentiles {
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export interface SourceMetrics {
  source_id: string;
  uptime_s: number;
  frames_received: number;
  frames_processed: number;
  frames_dropped: number;
  drop_rate: number | null;
  input_fps: number;
  processing_fps: number;
  infer_ms: Percentiles;
  latency_ms: Percentiles;
  reconnects: number;
  inference_errors: number;
  events: Record<string, number>;
  clips_written: number;
  clips_failed: number;
}

export interface HealthResponse {
  time: string;
  sources: SourceHealth[];
}

export interface MetricsResponse {
  time: string;
  sources: SourceMetrics[];
}

export interface MonitoringData {
  health: HealthResponse | null;
  observations: Record<string, Observation> | null;
  events: IndustrialEvent[] | null;
  metrics: MetricsResponse | null;
}

export type MonitoringEndpoint = keyof MonitoringData;
export type EndpointErrors = Partial<Record<MonitoringEndpoint, string>>;
