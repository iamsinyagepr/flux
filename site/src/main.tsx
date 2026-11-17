import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./site.css";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App path={location.pathname} />
  </StrictMode>
);
// A prerendered page is hydrated; the dev server's empty one is drawn.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
