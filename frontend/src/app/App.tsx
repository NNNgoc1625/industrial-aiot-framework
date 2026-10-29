import {
  Activity,
  Bell,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Menu,
  RadioTower,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import DataValidationPage from "../features/data-validation/DataValidationPage";
import MonitoringPage from "../features/monitoring/MonitoringPage";
import { apiBaseUrl } from "../shared/api/client";
import { useMonitoringData } from "../features/monitoring/useMonitoringData";

type PageId = "monitoring" | "validation";

export default function App() {
  const [page, setPage] = useState<PageId>("monitoring");
  const [demoMode, setDemoMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const monitoring = useMonitoringData(demoMode);
  /**
   * Report a connected state only when every monitoring endpoint succeeded in the latest poll.
   * Partial responses remain available, but do not imply the full API is healthy.
   */
  const apiOnline = !demoMode
    && Boolean(monitoring.data.health && monitoring.data.events && monitoring.data.metrics && monitoring.data.observations)
    && Object.keys(monitoring.errors).length === 0;
  const hasLoadedData = Boolean(
    monitoring.data.health || monitoring.data.events || monitoring.data.metrics || monitoring.data.observations,
  );
  const connectionLabel = demoMode
    ? "DEMO"
    : apiOnline
      ? "API CONNECTED"
      : !hasLoadedData && monitoring.refreshing
        ? "CONNECTING"
        : "API OFFLINE";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "menu-open" : ""}`}>
        <a className="brand" href="#" aria-label="Industrial AIoT Operator">
          <span className="brand-mark"><Activity size={20} /></span>
          <span className="brand-copy"><strong>INDUSTRIAL<span>AIoT</span></strong><small>OPERATOR CONSOLE</small></span>
        </a>
        <div className="site-switcher">
          <span className="site-avatar">F</span>
          <span><strong>Factory Lab</strong><small>Môi trường nội bộ</small></span>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <span className="nav-section">VẬN HÀNH</span>
          <button className={`nav-item ${page === "monitoring" ? "active" : ""}`} onClick={() => { setPage("monitoring"); setMobileMenuOpen(false); }}>
            <LayoutDashboard size={17} /><span>Tổng quan</span><span className="nav-bullet" />
          </button>
          <button className={`nav-item ${page === "validation" ? "active" : ""}`} onClick={() => { setPage("validation"); setMobileMenuOpen(false); }}>
            <ShieldCheck size={17} /><span>Kiểm định dữ liệu</span>
          </button>
          <button className="nav-item nav-disabled" title="Backend chưa có API workflow" disabled>
            <Settings2 size={17} /><span>Workflow</span><span className="soon-tag">Sắp tới</span>
          </button>
          <span className="nav-section nav-section-spaced">HỆ THỐNG</span>
          <button className="nav-item nav-disabled" title="Backend chưa có API thiết bị" disabled>
            <RadioTower size={17} /><span>Thiết bị IoT</span><span className="soon-tag">Sắp tới</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><CircleHelp size={17} /><span>Hướng dẫn</span></button>
          <div className="operator-card">
            <span className="operator-avatar">OP</span>
            <span><strong>Operator</strong><small>Local session</small></span>
            <span className="operator-status" />
          </div>
          <div className="sidebar-version">AIoT MONITORING · MVP 0.1</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Mở menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Factory Lab</span><span>/</span><strong>{page === "monitoring" ? "Tổng quan" : "Kiểm định dữ liệu"}</strong></div>
          <div className="topbar-actions">
            <label className="demo-toggle">
              <input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />
              <span className="toggle-track" />
              <span>Dữ liệu mẫu</span>
            </label>
            <span className={`connection-pill ${demoMode ? "demo" : apiOnline ? "online" : "offline"}`}>
              <span className="status-dot" />
              {connectionLabel}
            </span>
            <button className="icon-button notification-button" aria-label="Thông báo"><Bell size={17} /><i /></button>
          </div>
        </header>

        <div className="page-content">
          {page === "monitoring" ? (
            <MonitoringPage
              data={monitoring.data}
              errors={monitoring.errors}
              lastUpdated={monitoring.lastUpdated}
              refreshing={monitoring.refreshing}
              onRefresh={() => void monitoring.refresh()}
              demoMode={demoMode}
            />
          ) : <DataValidationPage />}
        </div>
        <footer className="app-footer">
          <span>Industrial AIoT · Prototype</span>
          <span><span className={`footer-dot ${apiOnline ? "connected" : demoMode ? "demo-dot" : ""}`} /> API: {apiBaseUrl}</span>
          <span>Dữ liệu vận hành chỉ lưu tại thiết bị nội bộ</span>
        </footer>
      </main>
      {mobileMenuOpen && <button className="mobile-overlay" aria-label="Đóng menu" onClick={() => setMobileMenuOpen(false)} />}
    </div>
  );
}
