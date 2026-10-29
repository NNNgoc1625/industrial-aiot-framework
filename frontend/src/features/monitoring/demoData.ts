import type {
  HealthResponse,
  IndustrialEvent,
  MetricsResponse,
  MonitoringData,
  Observation,
} from "../../shared/api/types";

/**
 * Fixed sample timeline keeps demo event IDs and timestamps deterministic.
 * These fixtures are display-only and must never be confused with live API data.
 */
const now = new Date("2026-10-23T11:04:12+07:00").getTime();
const at = (offsetMinutes: number) => new Date(now - offsetMinutes * 60_000).toISOString();

const events: IndustrialEvent[] = [
  {
    event_id: "cam01-20261023T110112-a1b2c3",
    source_id: "cam01",
    event_type: "zone_intrusion",
    occurred_at: at(3),
    created_at: at(3),
    result: { zone_id: "restricted_a", track_id: 7, class: "person", confidence: 0.94, dwell_s: 2.4 },
    evidence_path: null,
    evidence_clip: null,
  },
  {
    event_id: "cam02-20261023T105512-c4d5e6",
    source_id: "cam02",
    event_type: "source_offline",
    occurred_at: at(9),
    created_at: at(9),
    result: { state: "reconnecting", reconnects: 2, last_error: "Connection timed out" },
    evidence_path: null,
    evidence_clip: null,
  },
  {
    event_id: "cam01-20261023T104512-f7a8b9",
    source_id: "cam01",
    event_type: "zone_intrusion",
    occurred_at: at(19),
    created_at: at(19),
    result: { zone_id: "restricted_a", track_id: 4, class: "person", confidence: 0.89, dwell_s: 1.7 },
    evidence_path: null,
    evidence_clip: null,
  },
  {
    event_id: "cam02-20261023T104012-d0e1f2",
    source_id: "cam02",
    event_type: "source_recovered",
    occurred_at: at(24),
    created_at: at(24),
    result: { state: "running", reconnects: 2, last_error: null },
    evidence_path: null,
    evidence_clip: null,
  },
];

const health: HealthResponse = {
  time: new Date(now).toISOString(),
  sources: [
    {
      source_id: "cam01",
      uri: "data/vtest.avi",
      state: "running",
      healthy: true,
      fps: 10.1,
      processing_fps: 9.8,
      frames_received: 602,
      frames_dropped: 11,
      buffered: 1,
      reconnects: 0,
      last_error: null,
      last_frame_age_s: 0.2,
    },
    {
      source_id: "cam02",
      uri: "rtsp://camera-02/stream",
      state: "reconnecting",
      healthy: false,
      fps: 0,
      processing_fps: 0,
      frames_received: 0,
      frames_dropped: 0,
      buffered: 0,
      reconnects: 2,
      last_error: "Connection timed out",
      last_frame_age_s: 84.4,
    },
  ],
};

const observations: Record<string, Observation> = {
  cam01: {
    source_id: "cam01",
    status: "ok",
    seq: 1532,
    measured_at: at(0),
    counts: { person: 3 },
    tracks: [],
    infer_ms: 46.9,
    latency_ms: 49.6,
  },
  cam02: {
    source_id: "cam02",
    status: "error",
    measured_at: at(1),
    error: "Source is reconnecting; no current frame.",
  },
};

const metrics: MetricsResponse = {
  time: new Date(now).toISOString(),
  sources: [
    {
      source_id: "cam01",
      uptime_s: 3600,
      frames_received: 602,
      frames_processed: 590,
      frames_dropped: 11,
      drop_rate: 0.018,
      input_fps: 10.1,
      processing_fps: 9.8,
      infer_ms: { p50: 46.9, p95: 67.9, max: 1520 },
      latency_ms: { p50: 49.6, p95: 77, max: 1515 },
      reconnects: 0,
      inference_errors: 0,
      events: { zone_intrusion: 23 },
      clips_written: 23,
      clips_failed: 0,
    },
    {
      source_id: "cam02",
      uptime_s: 3600,
      frames_received: 0,
      frames_processed: 0,
      frames_dropped: 0,
      drop_rate: null,
      input_fps: 0,
      processing_fps: 0,
      infer_ms: { p50: null, p95: null, max: null },
      latency_ms: { p50: null, p95: null, max: null },
      reconnects: 2,
      inference_errors: 0,
      events: { source_offline: 1 },
      clips_written: 0,
      clips_failed: 0,
    },
  ],
};

export const demoMonitoringData: MonitoringData = {
  health,
  observations,
  events,
  metrics,
};
