// flux dev injects this into the site it serves (only in dev): it mounts the
// editor in a shadow root of its own, so the page's styles don't reach the
// editor and Studio's styles don't reach the page.
import { createRoot } from "react-dom/client";
import { setPortalRoot } from "../host/portal";
import { App } from "./App";
// Text, from the build: Studio's tokens on :host, studio.css, ours.
import styles from "virtual:overlay-styles";

function mount() {
  if (document.querySelector("flux-editor")) return;
  const host = document.createElement("flux-editor");
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  shadow.appendChild(style);
  const container = document.createElement("div");
  shadow.appendChild(container);
  // Menus and cards portal here, inside the shadow root.
  const portals = document.createElement("div");
  portals.className = "studio-root flux-portals";
  shadow.appendChild(portals);
  setPortalRoot(portals);
  createRoot(container).render(<App host={host} />);
}

// After the page has hydrated: nothing of ours is in the DOM React hydrates,
// and no edit can land between the server's render and the browser's (the
// browser would hydrate the edited page against the unedited HTML).
// TanStack Start removes self.$_TSR once hydrated; route code keeps loading
// after window's load, so that's the signal waited for (at most 15 seconds).
function whenHydrated(then: () => void) {
  const started = Date.now();
  const check = () => {
    if (!("$_TSR" in self) || Date.now() - started > 15000) then();
    else setTimeout(check, 50);
  };
  check();
}
const later = () => whenHydrated(mount);
if (document.readyState === "complete") later();
else window.addEventListener("load", later, { once: true });
