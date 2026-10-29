# API & Service Communication Contracts

The operator UI consumes four read-only JSON endpoints from the existing CV service and two binary evidence routes; the browser polls for updated monitoring data every five seconds. Local file validation runs entirely in the browser and does not upload data.

## Service Catalog

| Service | Port | Category | Purpose |
|---|---:|---|---|
| `aiot-stream-cv` HTTP API | 8080 (configurable; default bind `127.0.0.1`) | API Layer | Exposes camera health, observations, events, metrics, snapshots, and event evidence. |
| Operator UI (Vite development server) | 5173 (default) | API Client | Browser dashboard and local data validation; static production assets can be served by an on-prem web server. |

## API Endpoints Inventory

| Service | Method | Path | Request Type | Response Type |
|---|---|---|---|---|
| `aiot-stream-cv` | GET | `/health` | None | `{ time, sources: SourceHealth[] }` |
| `aiot-stream-cv` | GET | `/observations` | None | `Record<source_id, Observation>` |
| `aiot-stream-cv` | GET | `/events?limit=N` | Optional integer query; defaults to 50 | `Event[]` newest first; `400` for non-integer limit |
| `aiot-stream-cv` | GET | `/metrics` | None | `{ time, sources: SourceMetrics[] }` |
| `aiot-stream-cv` | GET | `/snapshot/{source_id}.jpg` | Source ID path parameter | JPEG bytes; `404` when source/frame is unavailable; `500` if encoding fails |
| `aiot-stream-cv` | GET | `/evidence/{file}` | Evidence filename path parameter | JPEG or MP4 bytes; `404` when the file is absent |
| `aiot-stream-cv` | GET | Other paths | None | JSON `404` with supported route list |

The frontend requests up to 100 events. It uses `evidence_path` and `evidence_clip` filenames to construct `/evidence/{file}` URLs. There are no write, acknowledgement, workflow, dataset-upload, or device-control endpoints in the current service.

## Management & Observability Endpoints

| Service | Endpoint | Custom Metrics (if any) |
|---|---|---|
| `aiot-stream-cv` | `GET /health` | Per-source state, healthy flag, FPS, frames received/dropped/buffered, reconnects, and last error |
| `aiot-stream-cv` | `GET /metrics` | Per-source uptime, frame counts, drop rate, FPS, inference/latency p50/p95/max, reconnects, inference errors, event counts, and clip counts |

## DTOs & Contracts

- **`Event`**: event ID, source ID, event type, occurred/created timestamps, type-specific `result`, and nullable evidence paths. Current event types are `zone_intrusion`, `source_offline`, `source_recovered`, and `source_ended`.
- **`SourceHealth`**: source identity/URI, state, healthy flag, input and processing rates, ingest counters, reconnect count, last error, and last-frame age.
- **`Observation`**: latest result for a source. `status: "ok"` carries counts, tracks, inference and latency measurements; `status: "error"` carries an error and must not be interpreted as zero detections.
- **`SourceMetrics`**: run counters and percentile objects for inference and end-to-end latency.
- **Sensor data convention (not yet served by this backend)**: the CV stream's data contract suggests `source_id`, `measured_at`, `received_at`, and `quality` for future sensor sources; the complete payload, units, quality values, and validation thresholds remain to be agreed by the team.

The service currently serializes Python dictionaries as JSON; no OpenAPI schema or version prefix is implemented. The frontend defines TypeScript interfaces and validates essential response shape at runtime. Timestamps are ISO-8601 strings with an explicit UTC offset. The local validator supports JSON, JSONL/NDJSON, and CSV; its file input remains on-device and is not an API request.

## Communication Patterns

- **Monitoring**: browser → synchronous HTTP GET → CV API → in-process source pipelines/event store → JSON response. The UI polls all four JSON endpoints concurrently every five seconds and applies an eight-second client request timeout. Failed endpoints show explicit errors and retain the last successful response as potentially stale.
- **Evidence**: browser loads a snapshot/evidence resource separately over HTTP when an event is opened.
- **Pipeline resilience**: stream capture reconnects with exponential backoff from 1 to 30 seconds; the browser does not implement automatic retry beyond its next scheduled poll or a user-triggered refresh.
- **Storage**: events are stored as JSONL and recent events are held in memory; no database or message broker is used by this service.
- **Gateway / discovery / async messaging**: none found. The browser directly calls the configured API base URL.
- **Startup**: start the CV service before using live dashboard data. The frontend can run independently; its explicit demo mode is only for preview.
- **Security posture**: the sample API binds to `127.0.0.1` by default, enables `Access-Control-Allow-Origin: *`, and has no authentication, authorization, or TLS. Keep it on a trusted local network and add access control/TLS before exposing it beyond localhost. Evidence and monitoring endpoints may contain sensitive operational data.
- **Not implemented**: event acknowledgement, workflow configuration/execution, sensor ingestion, dataset upload, and device commands need a separate team-approved contract before the UI can safely offer those actions.

## Service Technology Matrix

| Service | Web | Data Access | Discovery | Gateway | Actuator | Cache | Metrics |
|---|---|---|---|---|---|---|---|
| `aiot-stream-cv` | Python stdlib HTTP server | JSONL + in-memory recent events | None | None | Custom `/health` | In-memory latest observations/frames | Custom `/metrics`, `output/metrics.json` |
| Operator UI | Vite dev server / static browser client | Read-only HTTP API; local browser file parsing | None | None | None | Latest successful response held in React state | Client connection/error status |

## Service Communication Sequence

<!-- mermaid-checked: every participant uses `participant Id as "Label"`, no \n in aliases/messages/notes, every alt/opt/loop closed by end, no `:` inside any alias -->
~~~mermaid
sequenceDiagram
    participant Operator as "Operator Browser"
    participant UI as "React Operator UI"
    participant API as "CV HTTP API"
    participant Pipeline as "Source Pipeline"
    participant Store as "Event Store"

    loop Every five seconds
        UI->>API: GET /health
        UI->>API: GET /observations
        UI->>API: GET /events?limit=100
        UI->>API: GET /metrics
        API->>Pipeline: Read health observations metrics
        Pipeline-->>API: Per-source data
        API->>Store: Read recent events
        Store-->>API: Event list
        API-->>UI: JSON monitoring responses
        alt API request fails
            API-->>UI: HTTP error or timeout
            UI-->>Operator: Show endpoint error and stale-data state
        else API request succeeds
            UI-->>Operator: Render current monitoring data
        end
    end
    Operator->>UI: Open event details
    UI->>API: GET /evidence/{file}
    API-->>UI: JPEG or MP4 evidence
    UI-->>Operator: Display event and evidence
~~~
