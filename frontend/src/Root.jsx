import React, { Suspense, lazy, useEffect, useState, Component } from "react";

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100dvh", gap: "12px", color: "#334155", fontFamily: "Inter, system-ui, sans-serif" }}>
          <p style={{ margin: 0 }}>Failed to load — please refresh the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = lazy(() => import("./App.jsx"));
const AdminPortal = lazy(() => import("./components/AdminPortal.jsx"));

function getRouteFromHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

const LoadingFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100dvh",
      fontSize: "14px",
      color: "#334155",
      background: "#f6f8fb",
    }}
  >
    Loading…
  </div>
);

export default function Root() {
  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const isAdminRoute =
    route === "/admin" ||
    route.startsWith("/admin/");

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {isAdminRoute ? <AdminPortal /> : <App />}
      </Suspense>
    </ChunkErrorBoundary>
  );
}
