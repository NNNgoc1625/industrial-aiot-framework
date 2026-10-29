import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Cpu,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { snapshotUrl } from "../../shared/api/client";
import type { IndustrialEvent, MonitoringData, Observation, SourceHealth } from "../../shared/api/types";
import { eventLabel, eventSummary, eventTone, formatTime } from "../events/eventPresentation";
import { EventDetailsDialog } from "../events/EventDetailsDialog";

interface MonitoringPageProps {
  data: MonitoringData;
  errors: Partial<Record<keyof MonitoringData, string>>;
  lastUpdated: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  demoMode: boolean;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Camera;
  tone: "blue" | "green" | "orange" | "violet";
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
      <div className="metric-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <div className="metric-trend"><ArrowUpRight size={14} /> Live</div>
    </article>
  );
}

/**
 * Shows one source's latest frame or an explicit unavailable/demo placeholder.
 * Object totals are withheld when inference status is an error.
 */
function SourceCard({
  source,
  observation,
  updatedAt,
  demoMode,
  selected,
  onSelect,
}: {
  source: SourceHealth;
  observation: Observation | undefined;
  updatedAt: number | null;
  demoMode: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const running = source.healthy;
  const count = observation?.status === "ok"
    ? Object.values(observation.counts ?? {}).reduce((total, current) => total + current, 0)
    : null;
  return (
    <button className={`source-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="source-preview">
        {running && updatedAt !== null && !demoMode ? (
          <img src={snapshotUrl(source.source_id, updatedAt)} alt={`Khung hình hiện tại ${source.source_id}`} />
        ) : (
          <div className="source-placeholder">
            {running ? <Camera size={28} /> : <WifiOff size={28} />}
            <span>{demoMode && running ? "Khung hình minh họa" : running ? "Đang chờ khung hình" : "Không có tín hiệu"}</span>
          </div>
        )}
        <span className={`source-state ${running ? "is-running" : "is-offline"}`}>
          <span className="status-dot" />
          {running ? "ĐANG CHẠY" : source.state.toUpperCase()}
        </span>
        <span className="preview-label">{source.source_id}</span>
      </div>
      <div className="source-meta">
        <div>
          <strong>{source.source_id}</strong>
          <span className="source-uri" title={source.uri}>{source.uri}</span>
        </div>
        <div className="source-meta-stats">
          <span><Activity size={13} /> {source.processing_fps.toFixed(1)} fps</span>
          <span><Radio size={13} /> {count === null ? "—" : `${count} đối tượng`}</span>
        </div>
      </div>
      {source.last_error && <div className="source-error"><AlertTriangle size={13} /> {source.last_error}</div>}
    </button>
  );
}

export default function MonitoringPage({
  data,
  errors,
  lastUpdated,
  refreshing,
  onRefresh,
  demoMode,
}: MonitoringPageProps) {
  const [filter, setFilter] = useState("all");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IndustrialEvent | null>(null);
  const sources = data.health?.sources ?? [];
  const metrics = data.metrics?.sources ?? [];
  const events = data.events ?? [];
  const errorMessages = Object.entries(errors).filter(([, message]) => message);
  const activeCameras = sources.filter((source) => source.healthy).length;
  /**
   * Only successful observations contribute to detection totals; an inference error is unknown,
   * not evidence that the scene contains zero objects.
   */
  const allDetections = Object.values(data.observations ?? {}).reduce((total, observation) => {
    if (observation.status !== "ok") return total;
    return total + Object.values(observation.counts ?? {}).reduce((sum, count) => sum + count, 0);
  }, 0);
  const eventCount = metrics.reduce(
    (total, source) => total + Object.values(source.events).reduce((sum, count) => sum + count, 0),
    0,
  );
  const p95Values = metrics.map((source) => source.latency_ms.p95).filter((value): value is number => value !== null);
  const maxP95 = p95Values.length
    ? Math.max(...p95Values)
    : null;
  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      if (filter === "all") return true;
      if (filter === "alerts") return event.event_type === "zone_intrusion" || event.event_type === "source_offline";
      return event.event_type === filter;
    }).slice(0, 6);
  }, [events, filter]);
  const sourceSelected = selectedSource ?? sources[0]?.source_id ?? null;

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">TRUNG TÂM VẬN HÀNH / TỔNG QUAN</div>
          <h1>Giám sát hệ thống</h1>
          <p>Theo dõi nguồn dữ liệu, kết quả AI và sự kiện đang diễn ra.</p>
        </div>
        <div className="heading-actions">
          <span className="updated-label">
            <Clock3 size={14} />
            {lastUpdated ? `Cập nhật ${formatTime(new Date(lastUpdated).toISOString())}` : "Chưa có dữ liệu"}
          </span>
          <button className="button button-secondary" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            Làm mới
          </button>
        </div>
      </section>

      {demoMode && (
        <div className="notice notice-demo"><CircleHelp size={17} /> Chế độ minh họa — số liệu bên dưới không phải dữ liệu vận hành.</div>
      )}
      {errorMessages.length > 0 && !demoMode && (
        <div className="notice notice-error">
          <WifiOff size={17} />
          <div><strong>Một số API chưa phản hồi.</strong> Dữ liệu hiển thị gần nhất có thể đã cũ.
            <small>{errorMessages.map(([endpoint, message]) => `${endpoint}: ${message}`).join(" · ")}</small>
          </div>
        </div>
      )}

      <section className="metrics-grid" aria-label="Chỉ số hệ thống">
        <MetricCard title="Nguồn đang hoạt động" value={`${activeCameras}/${sources.length}`} detail="Nguồn video trực tuyến" icon={Camera} tone="blue" />
        <MetricCard title="Đối tượng hiện tại" value={allDetections.toLocaleString("vi-VN")} detail="Tổng từ các observation hợp lệ" icon={Activity} tone="green" />
        <MetricCard title="Sự kiện trong phiên" value={eventCount.toLocaleString("vi-VN")} detail="Theo thống kê của pipeline" icon={AlertTriangle} tone="orange" />
        <MetricCard title="Độ trễ p95 cao nhất" value={maxP95 === null ? "—" : `${maxP95.toFixed(0)} ms`} detail="Lớn nhất trong các nguồn có số liệu" icon={Cpu} tone="violet" />
      </section>

      <section className="content-grid">
        <div className="panel source-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NGUỒN DỮ LIỆU</span>
              <h2>Camera & luồng video <span className="count-pill">{sources.length}</span></h2>
            </div>
            <span className="live-indicator"><span className="status-dot" /> Cập nhật mỗi 5 giây</span>
          </div>
          {sources.length > 0 ? (
            <div className="sources-grid">
              {sources.map((source) => (
                <SourceCard
                  key={source.source_id}
                  source={source}
                  observation={data.observations?.[source.source_id]}
                  updatedAt={lastUpdated}
                  demoMode={demoMode}
                  selected={sourceSelected === source.source_id}
                  onSelect={() => setSelectedSource(source.source_id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Camera} title="Chưa nhận được trạng thái nguồn" description="Kiểm tra CV service tại http://127.0.0.1:8080 rồi thử làm mới." />
          )}
        </div>

        <div className="panel health-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">TÌNH TRẠNG</span><h2>Sức khỏe nguồn</h2></div>
            <Wifi size={18} className="muted-icon" />
          </div>
          {sources.length > 0 ? (
            <div className="health-list">
              {sources.map((source) => (
                <div className="health-row" key={source.source_id}>
                  <span className={`health-icon ${source.healthy ? "healthy" : "unhealthy"}`}>
                    {source.healthy ? <CheckCircle2 size={16} /> : <WifiOff size={16} />}
                  </span>
                  <div className="health-copy">
                    <strong>{source.source_id}</strong>
                    <span>{source.healthy ? "Đang nhận dữ liệu" : source.state}</span>
                  </div>
                  <span className={`health-value ${source.healthy ? "text-success" : "text-warning"}`}>
                    {source.last_frame_age_s === null ? "—" : `${source.last_frame_age_s.toFixed(1)}s`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CircleHelp} title="Chưa có dữ liệu sức khỏe" description="Trạng thái sẽ xuất hiện khi API kết nối thành công." compact />
          )}
          <div className="health-footer">
            <span>Khung hình bị bỏ</span>
            <strong>{sources.reduce((total, source) => total + source.frames_dropped, 0).toLocaleString("vi-VN")}</strong>
            <span className="health-footer-note"><ArrowDownRight size={13} /> Drop-oldest khi xử lý chậm</span>
          </div>
        </div>
      </section>

      <section className="panel event-panel">
        <div className="panel-heading event-heading">
          <div>
            <span className="eyebrow">THEO DÕI THỜI GIAN THỰC</span>
            <h2>Sự kiện gần đây <span className="count-pill">{events.length}</span></h2>
          </div>
          <label className="filter-control">
            <span className="sr-only">Lọc sự kiện</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Tất cả sự kiện</option>
              <option value="alerts">Cảnh báo</option>
              <option value="zone_intrusion">Xâm nhập vùng</option>
              <option value="source_offline">Mất kết nối</option>
              <option value="source_recovered">Đã kết nối lại</option>
              <option value="source_ended">Nguồn đã kết thúc</option>
            </select>
          </label>
        </div>
        {visibleEvents.length > 0 ? (
          <div className="event-table-wrap">
            <table className="event-table">
              <thead><tr><th>Loại sự kiện</th><th>Nguồn</th><th>Chi tiết</th><th>Thời điểm</th><th /></tr></thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.event_id} onClick={() => setSelectedEvent(event)} tabIndex={0} onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter") setSelectedEvent(event);
                  }}>
                    <td><span className={`event-badge ${eventTone(event.event_type)}`}><span className="status-dot" />{eventLabel(event.event_type)}</span></td>
                    <td className="mono">{event.source_id}</td>
                    <td className="event-summary">{eventSummary(event)}</td>
                    <td className="time-cell">{formatTime(event.occurred_at)}</td>
                    <td><button className="row-action" aria-label={`Xem ${event.event_id}`} onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      setSelectedEvent(event);
                    }}>Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={AlertTriangle} title="Chưa có sự kiện phù hợp" description={events.length ? "Thử đổi bộ lọc sự kiện." : "Sự kiện từ CV service sẽ hiển thị tại đây."} compact />
        )}
      </section>
      <EventDetailsDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: typeof Camera;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
