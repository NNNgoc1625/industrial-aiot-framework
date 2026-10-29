import type { IndustrialEvent } from "../../shared/api/types";

const LABELS: Record<string, string> = {
  zone_intrusion: "Xâm nhập vùng",
  source_offline: "Mất kết nối",
  source_recovered: "Đã kết nối lại",
  source_ended: "Nguồn đã kết thúc",
};

export function eventLabel(eventType: string): string {
  return LABELS[eventType] ?? eventType.replaceAll("_", " ");
}

export function eventTone(eventType: string): "danger" | "warning" | "success" | "neutral" {
  if (eventType === "zone_intrusion") return "danger";
  if (eventType === "source_offline") return "warning";
  if (eventType === "source_recovered") return "success";
  return "neutral";
}

export function eventSummary(event: IndustrialEvent): string {
  const result = event.result;
  if (event.event_type === "zone_intrusion") {
    const zone = typeof result.zone_id === "string" ? result.zone_id : "—";
    const confidence = typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "—";
    return `Vùng ${zone} · Tin cậy ${confidence}`;
  }
  if (typeof result.last_error === "string") return result.last_error;
  return `Trạng thái ${typeof result.state === "string" ? result.state : "—"}`;
}

export function formatTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Thời gian không hợp lệ";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Thời gian không hợp lệ";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
