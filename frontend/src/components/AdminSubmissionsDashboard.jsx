import React, { useCallback, useMemo, useState } from "react";
import StatusBanner from "./StatusBanner";
import "./AdminSubmissionsDashboard.css";
import { getApiBaseUrl } from "../utils/apiBase";

const API_BASE = getApiBaseUrl();

const ADMIN_KEY_STORAGE = "cal_admin_key_v1";

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

const AdminSubmissionsDashboard = () => {
  const apiUrl = useMemo(
    () => (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`,
    []
  );

  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem(ADMIN_KEY_STORAGE) || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const loadSubmissions = useCallback(async () => {
    if (!adminKey.trim() || loading) return;
    setError("");
    setLoading(true);

    try {
      localStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());

      const res = await fetch(apiUrl("/intake/submissions?limit=100"), {
        method: "GET",
        headers: { "X-Admin-Key": adminKey.trim() },
      });

      if (!res.ok) {
        let detail = "";
        try {
          const payload = await res.json();
          detail = payload?.detail ? String(payload.detail) : "";
        } catch {
          /* ignore */
        }
        throw new Error(detail || `Request failed (status ${res.status}).`);
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setError(
        e?.message && String(e.message).trim().length > 0
          ? String(e.message)
          : "Unable to load submissions."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey, loading, apiUrl]);

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <h1>Intake submissions</h1>
        <p className="admin-dashboard-subtitle">
          Admin-only view. Data comes from{" "}
          <code>GET /intake/submissions</code>.
        </p>
        <a className="admin-dashboard-home" href="#/">
          ← Back to app
        </a>
      </header>

      <section className="admin-dashboard-card">
        {error && (
          <StatusBanner type="error" className="admin-dashboard-banner" role="alert">
            {error}
          </StatusBanner>
        )}

        {loading && (
          <StatusBanner type="info" className="admin-dashboard-banner">
            Loading submissions…
          </StatusBanner>
        )}

        <div className="admin-dashboard-controls">
          <input
            className="admin-dashboard-input"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="X-Admin-Key"
            autoComplete="off"
          />
          <button
            type="button"
            className="admin-dashboard-button"
            onClick={loadSubmissions}
            disabled={loading || !adminKey.trim()}
          >
            {loading ? "Loading…" : "Load submissions"}
          </button>
        </div>

        <div className="admin-dashboard-table-wrap">
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Issue type</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={3} className="admin-dashboard-empty">
                    No rows yet. Enter your admin key and load submissions.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name ?? "—"}</td>
                    <td>{row.issue_type ?? "—"}</td>
                    <td>{formatTimestamp(row.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminSubmissionsDashboard;
