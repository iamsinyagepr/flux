// Synced from Upskale Studio (upskaleapp/src/console/components/studio/component-picker/ComponentPicker.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../../host/portal";
import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { MdSearch, MdClose, MdChevronRight } from "react-icons/md";
import type { ComponentTemplate } from "../../../../lib/studio/componentTemplates";
import type { ReferenceEntry } from "../../../../lib/studio/registry";
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { widgetCatalog, searchCatalog } from "../../../../lib/studio/visualModel";
import type { PickerChoice } from "../../../../components/studio/ComponentPicker";
import { BASIC_WIDGETS } from "../../../constants/studio/component-picker/index";

/**
 * The "Add" picker, as a modal: the basic widgets, this component's
 * snippets, the project's components and the component templates. One
 * search narrows them.
 */
export function ComponentPicker({
  request,
  exclude,
  snippets,
  components,
  templates,
  onPick,
  onClose,
}: {
  request: { title: string };
  /** Built-ins not offered here (a second Scaffold on a page). */
  exclude: string[];
  /** This component's snippets (Parts), offered by name. */
  snippets: string[];
  components: ReadonlyMap<string, ReferenceEntry>;
  templates: ComponentTemplate[];
  onPick: (item: PickerChoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  // Left: snippets, your components, every built-in widget and the templates.
  const choices: PickerChoice[] = useMemo(
    () => [
      ...snippets.map((name) => ({
        name,
        group: "Snippets",
        description: "Insert the " + name + " snippet from this component.",
        snippet: `Use(part: ${cdslString(name)})`,
      })),
      ...widgetCatalog(components).filter((item) => !exclude.includes(item.name) && item.name !== "Use"),
      ...templates.map((template) => ({
        name: template.title,
        group: "Templates",
        description: template.description,
        snippet: "",
        template,
      })),
    ],
    [components, templates, exclude.join(), snippets.join()],
  );
  const results = searchCatalog(choices, query).slice(0, 200) as PickerChoice[];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  let lastGroup = "";
  return createPortal(
    <div
      className="studio-picker-backdrop"
      // A portal still bubbles through React: keep the canvas from panning.
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="studio-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && (event.target as HTMLElement).closest(".studio-picker-left, .studio-picker-modal > header")) {
            event.preventDefault();
            setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(1, results.length));
          } else if (event.key === "Enter" && event.target instanceof HTMLInputElement && results[active]) {
            event.preventDefault();
            onPick(results[active]);
          }
        }}
      >
        <header>
          <strong>{request.title}</strong>
          <label className="studio-picker-search">
            <MdSearch aria-hidden="true" />
            <input
              autoFocus
              type="search"
              placeholder="Search widgets, your components and templates…"
              aria-label="Search components"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="button" className="studio-icon-button" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            <MdClose aria-hidden="true" />
          </button>
        </header>
        <div className="studio-picker-columns">
          <section className="studio-picker-left" aria-label="Widgets and project components">
            <div className="studio-visual-picker-basics" role="group" aria-label="Basic widgets">
              {BASIC_WIDGETS.map(([name, Icon]) => {
                const choice = choices.find((item) => item.name === name && !item.template && item.group !== "Snippets");
                if (!choice || (words.length && !results.includes(choice))) return null;
                return (
                  <button key={name} type="button" title={choice.description} onClick={() => onPick(choice)}>
                    <Icon aria-hidden="true" />
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
            <ul role="listbox" aria-label="Components">
              {results.map((item, index) => {
                const heading = item.group !== lastGroup ? item.group : undefined;
                lastGroup = item.group;
                return (
                  <li key={item.group + item.name} role="none">
                    {heading && (
                      <div className="studio-visual-picker-group">
                        {heading === "Your components" ? "In this project" : heading}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      data-index={index}
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => onPick(item)}
                    >
                      <span>{item.name}</span>
                      <small>{item.description}</small>
                    </button>
                  </li>
                );
              })}
              {!results.length && <li className="studio-visual-empty">No widgets match "{query}".</li>}
            </ul>
          </section>
        </div>
        <footer>
          <MdChevronRight aria-hidden="true" /> Enter adds the highlighted widget · Esc closes
        </footer>
      </div>
    </div>,
    portalRoot(),
  );
}

export default ComponentPicker;
