import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Clear any old service worker caches that cached API responses
if ('caches' in window) {
  caches.keys().then(names => {
    for (const name of names) {
      if (name.includes('api') || name.includes('local-api')) {
        caches.delete(name);
      }
    }
  });
}

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
