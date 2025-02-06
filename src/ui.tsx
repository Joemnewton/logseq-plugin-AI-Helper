import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

export function loadUI() {
  let container = document.getElementById("app");
  if (!container) {
    container = document.createElement("div");
    container.id = "app";
    document.body.appendChild(container);
  }
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}