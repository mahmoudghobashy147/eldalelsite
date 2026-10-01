import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import HomeLanding from "./HomeLanding";

(function restoreDeepLinkPath() {
  try {
    const redirect = sessionStorage.getItem("daleel_redirect_path");
    if (redirect) {
      sessionStorage.removeItem("daleel_redirect_path");
      window.history.replaceState(null, "", redirect);
    }
  } catch (e) {}
})();

const rootElement = document.getElementById("root");
const params = new URLSearchParams(window.location.search);
const isLandingHome = window.location.pathname === "/" && params.get("app") !== "1";

if (isLandingHome) {
  if (rootElement) rootElement.innerHTML = "";
  createRoot(rootElement).render(<HomeLanding />);
} else if (rootElement && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}
