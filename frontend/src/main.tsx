import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ANON, APP_NAME } from "./lib/anon";
import "./index.css";

// Runtime anonymous mode (?anon=1 on a non-anonymous build): the
// static HTML title was rendered before JS ran, so re-assert the
// neutral name here. Build-time anonymous bundles already have the
// neutral title baked into index.html (vite.config.ts).
if (ANON) document.title = APP_NAME;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
