import { X } from "lucide-react";
import { evidenceUrl } from "../../shared/api/client";
import type { IndustrialEvent } from "../../shared/api/types";
import { eventLabel, formatDateTime } from "./eventPresentation";

interface EventDetailsDialogProps {
  event: IndustrialEvent | null;
  onClose: () => void;
}

export function EventDetailsDialog({ event, onClose }: EventDetailsDialogProps) {
  if (!event) return null;
  const imageUrl = evidenceUrl(event.evidence_path);
  const clipUrl = evidenceUrl(event.evidence_clip);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(mouseEvent) => {
      if (mouseEvent.target === mouseEvent.currentTarget) onClose();
    }}>
      <section className="event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">CHI TIẾT SỰ KIỆN</span>
            <h2 id="event-dialog-title">{eventLabel(event.event_type)}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Đóng chi tiết">
            <X size={18} />
          </button>
        </div>
        {imageUrl ? (
          <img className="evidence-image" src={imageUrl} alt={`Bằng chứng ${event.event_id}`} />
        ) : (
          <div className="evidence-empty">
            <span>Chưa có ảnh bằng chứng</span>
            <small>API chỉ cung cấp ảnh khi sự kiện có evidence_path.</small>
          </div>
        )}
        <dl className="detail-grid">
          <div><dt>Mã sự kiện</dt><dd>{event.event_id}</dd></div>
          <div><dt>Nguồn</dt><dd>{event.source_id}</dd></div>
          <div><dt>Thời điểm ghi nhận</dt><dd>{formatDateTime(event.occurred_at)}</dd></div>
          <div><dt>Thời điểm lưu</dt><dd>{formatDateTime(event.created_at)}</dd></div>
        </dl>
        <div className="result-block">
          <div className="section-title">Kết quả xử lý</div>
          <pre>{JSON.stringify(event.result, null, 2)}</pre>
        </div>
        {clipUrl && (
          <a className="text-link" href={clipUrl} target="_blank" rel="noreferrer">
            Mở video bằng chứng
          </a>
        )}
      </section>
    </div>
  );
}
