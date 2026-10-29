import { AlertCircle, CheckCircle2, Download, FileCheck2, FileJson2, FileSpreadsheet, ShieldCheck, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  createReportDownload,
  validateFile,
  type ValidationProfile,
  type ValidationResult,
} from "./dataValidation";

export default function DataValidationPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ValidationProfile>("auto");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Runs the browser-only validator and exposes errors without uploading or retaining the file.
   * Resetting the input allows the same file to be selected again for another profile.
   */
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await validateFile(file, profile));
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : String(validationError));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">CHUẨN BỊ & KIỂM TRA DỮ LIỆU</div>
          <h1>Kiểm định dữ liệu</h1>
          <p>Kiểm tra nhanh cấu trúc event hoặc bản ghi sensor trước khi đưa vào workflow.</p>
        </div>
        <div className="local-only-badge"><ShieldCheck size={15} /> Xử lý cục bộ trên trình duyệt</div>
      </section>

      <div className="notice notice-info">
        <FileCheck2 size={18} />
        <div><strong>Dữ liệu không được tải lên server.</strong>
          <small>Phiên bản này kiểm tra file JSON/JSONL/CSV ngay trên thiết bị. Chưa thay thế quy trình gán nhãn ảnh/video hay đánh giá chất lượng mô hình.</small>
        </div>
      </div>

      <section className="validation-layout">
        <div className="panel upload-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BƯỚC 01</span><h2>Nạp tệp dữ liệu</h2></div>
            <FileJson2 size={19} className="muted-icon" />
          </div>
          <div className="profile-field">
            <label htmlFor="validation-profile">Loại dữ liệu</label>
            <select id="validation-profile" value={profile} onChange={(event) => setProfile(event.target.value as ValidationProfile)}>
              <option value="auto">Tự nhận diện</option>
              <option value="events">Sự kiện CV</option>
              <option value="sensors">Bản ghi cảm biến</option>
            </select>
          </div>
          <button
            className={`drop-zone ${busy ? "busy" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files[0]);
            }}
            disabled={busy}
          >
            <span className="upload-icon">{busy ? <span className="loader" /> : <Upload size={23} />}</span>
            <strong>{busy ? "Đang kiểm tra dữ liệu..." : "Thả tệp vào đây hoặc chọn từ máy"}</strong>
            <span>Hỗ trợ .json, .jsonl, .ndjson, .csv · tối đa 10 MB</span>
          </button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".json,.jsonl,.ndjson,.csv,application/json,text/csv"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {error && <div className="inline-error"><AlertCircle size={16} />{error}</div>}
          <div className="supported-files">
            <span><FileJson2 size={15} /> JSON / JSONL</span>
            <span><FileSpreadsheet size={15} /> CSV</span>
          </div>
        </div>

        <div className="panel rules-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BƯỚC 02</span><h2>Quy tắc kiểm tra</h2></div>
            <ShieldCheck size={19} className="muted-icon" />
          </div>
          <div className="rule-list">
            <div><CheckCircle2 size={16} /><span><strong>Event</strong> — trường bắt buộc, thời gian, loại sự kiện, kết quả và ID trùng.</span></div>
            <div><CheckCircle2 size={16} /><span><strong>Sensor</strong> — source, measured/received time, quality và bản ghi trùng theo data contract hiện có.</span></div>
            <div><CheckCircle2 size={16} /><span><strong>CSV</strong> — tiêu đề rỗng/trùng, cột nhất quán và trường có dấu phẩy.</span></div>
          </div>
          <div className="rule-footnote">Quy tắc sensor dựa trên quy ước dự kiến trong data contract của CV stream; schema đầy đủ cần được nhóm thống nhất trước khi tích hợp cảm biến.</div>
        </div>
      </section>

      {result ? (
        <ValidationReport result={result} onDismiss={() => setResult(null)} />
      ) : (
        <section className="panel validation-empty">
          <span className="empty-icon"><FileCheck2 size={21} /></span>
          <strong>Kết quả kiểm định sẽ xuất hiện tại đây</strong>
          <span>Tệp chỉ được đọc tạm thời trong trình duyệt và không được lưu trữ.</span>
        </section>
      )}
    </>
  );
}

/**
 * Summarizes validation results and limits on-screen issue rows for readability.
 * The downloadable report retains the complete issue list.
 */
function ValidationReport({
  result,
  onDismiss,
}: {
  result: ValidationResult;
  onDismiss: () => void;
}) {
  const invalidRows = result.totalRows - result.validRows;
  const hasIssues = result.issues.length > 0;
  return (
    <section className="panel report-panel">
      <div className="panel-heading report-heading">
        <div>
          <span className="eyebrow">KẾT QUẢ KIỂM ĐỊNH · {result.profile.toUpperCase()}</span>
          <h2>{result.fileName}</h2>
        </div>
        <div className="report-actions">
          <button className="button button-secondary" onClick={() => createReportDownload(result)}><Download size={15} /> Xuất báo cáo</button>
          <button className="icon-button" aria-label="Đóng kết quả" onClick={onDismiss}><X size={17} /></button>
        </div>
      </div>
      <div className="validation-stats">
        <div><span>Tổng bản ghi</span><strong>{result.totalRows.toLocaleString("vi-VN")}</strong></div>
        <div className="valid-stat"><span>Hợp lệ</span><strong>{result.validRows.toLocaleString("vi-VN")}</strong></div>
        <div className={invalidRows > 0 ? "invalid-stat" : ""}><span>Bản ghi có lỗi</span><strong>{invalidRows.toLocaleString("vi-VN")}</strong></div>
        <div><span>Lỗi kiểm tra</span><strong>{result.issues.length.toLocaleString("vi-VN")}</strong></div>
      </div>
      {result.columns.length > 0 && (
        <div className="column-list"><span>Các cột:</span>{result.columns.map((column) => <code key={column}>{column}</code>)}</div>
      )}
      {hasIssues ? (
        <div className="issues-wrap">
          <div className="section-title"><AlertCircle size={15} /> Vấn đề cần xem lại</div>
          <div className="issues-table-wrap">
            <table className="issues-table">
              <thead><tr><th>Dòng</th><th>Trường</th><th>Mô tả</th></tr></thead>
              <tbody>
                {result.issues.slice(0, 100).map((issue, index) => (
                  <tr key={`${issue.row}-${issue.field}-${index}`}><td>{issue.row}</td><td><code>{issue.field}</code></td><td>{issue.message}</td></tr>
                ))}
              </tbody>
            </table>
            {result.issues.length > 100 && <div className="table-footnote">Đang hiển thị 100/{result.issues.length} lỗi. Báo cáo tải xuống chứa toàn bộ kết quả.</div>}
          </div>
        </div>
      ) : (
        <div className="clean-result"><CheckCircle2 size={17} /> Không phát hiện lỗi theo bộ quy tắc đã chọn.</div>
      )}
    </section>
  );
}
