import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";

const App = lazy(() => import("./App.jsx"));

const LoadingFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontSize: "14px",
      color: "#334155",
      background: "#f6f8fb",
    }}
  >
    Loading…
  </div>
);

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <StrictMode>
    <Suspense fallback={<LoadingFallback />}>
      <App />
    </Suspense>
  </StrictMode>
);
