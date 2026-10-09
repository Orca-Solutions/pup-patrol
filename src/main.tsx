import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// streamotter.dev's fonts, self-hosted as it does: Figtree for text, JetBrains Mono for numbers and data.
import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import { App } from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
