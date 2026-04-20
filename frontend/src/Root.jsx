import React, { Suspense, lazy, useEffect, useState } from "react";

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
    <Suspense fallback={<LoadingFallback />}>
      {isAdminRoute ? <AdminPortal /> : <App />}
    </Suspense>
  );
}
