// Synced from Upskale Studio (upskaleapp/src/console/components/studio/value-cards/ValueCards.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../../host/portal";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MdAdd, MdClose, MdDeleteOutline, MdSearch } from "react-icons/md";
import { ICON_CATALOG, ICON_GROUPS } from "../../../../lib/studio/iconCatalog";
import { iconLibraries, type IconLibrary, type StudioConfig } from "../../../../lib/studio/projectConfig";
import { tokenChoices } from "../../../../lib/studio/visualModel";
import { colors as previewColors } from "../../../constants/studio/source-renderer/index";
import { StudioIcon } from "../studio-icon/StudioIcon";

/**
 * The cards a context menu opens when a value needs choosing rather than
 * guessing: an icon from the catalogue, a border's width and colour, a
 * gradient's colours and style, data with an image in it. Each writes the
 * Flux for its value (onSet) and nothing until then; Escape, ✕ or a click
 * elsewhere writes nothing. Where the menu was, kept on screen.
 */
export function ValueCard({ x, y, title, onClose, wide = false, children }: { x: number; y: number; title: string; onClose(): void; wide?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setTimeout(onClose);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [onClose]);
  return createPortal(
    <div ref={box} role="dialog" aria-label={title} className={"studio-add-property-card studio-value-card" + (wide ? " is-wide" : "")} style={position}>
      <div className="studio-add-property-head">
        <strong>{title}</strong>
        <button type="button" className="studio-icon-button" aria-label="Cancel" title="Cancel" onClick={onClose}>
          <MdClose />
        </button>
      </div>
      {children}
    </div>,
    portalRoot(),
  );
}

/** Choose an icon: search by name or meaning, by group, in any library. */
export function IconPickerCard({
  x,
  y,
  title = "Choose an icon",
  config,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  title?: string;
  config?: StudioConfig;
  /** The icon's token: Icons.cart (the project's library), or another library's. */
  onPick(token: string): void;
  onClose(): void;
}) {
  const projectLibrary = config?.iconLibrary ?? "material";
  const [library, setLibrary] = useState<IconLibrary>(projectLibrary);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = ICON_CATALOG.filter((entry) => words.every((word) => (entry.name + " " + entry.keywords).toLowerCase().includes(word)));
  // The project's own library writes Icons.x, so changing the library in Config changes the icon too.
  const token = (name: string) => (library === projectLibrary ? "Icons." : iconLibraries[library].namespace + ".") + name;
  return (
    <ValueCard x={x} y={y} title={title} onClose={onClose} wide>
      <div className="studio-value-card-row">
        <label className="studio-value-card-search">
          <MdSearch aria-hidden="true" />
          <input
            ref={input}
            type="search"
            aria-label="Search icons"
            placeholder="Search icons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && shown[0]) onPick(token(shown[0].name));
            }}
          />
        </label>
        <div role="group" aria-label="Library" className="studio-value-card-segments">
          {(Object.keys(iconLibraries) as IconLibrary[]).map((key) => (
            <button key={key} type="button" aria-pressed={library === key} onClick={() => setLibrary(key)}>
              {iconLibraries[key].label}
            </button>
          ))}
        </div>
      </div>
      <div className="studio-icon-picker-groups">
        {ICON_GROUPS.map((group) => {
          const icons = shown.filter((entry) => entry.group === group);
          if (!icons.length) return null;
          return (
            <section key={group} aria-label={group}>
              <h4>{group}</h4>
              <ul className="studio-icon-picker-grid">
                {icons.map((entry) => (
                  <li key={entry.name}>
                    <button type="button" title={token(entry.name)} aria-label={entry.name} onClick={() => onPick(token(entry.name))}>
                      <StudioIcon token={token(entry.name)} library={projectLibrary} aria-hidden="true" />
                      <span>{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!shown.length && <p className="studio-value-card-empty">No icon matches “{query}”.</p>}
      </div>
    </ValueCard>
  );
}

/** A colour token, as a swatch and its name, for the forms below. */
function ColorSelect({ label, value, config, onChange }: { label: string; value: string; config?: StudioConfig; onChange(next: string): void }) {
  const choices = tokenChoices("Color", config);
  return (
    <label className="studio-value-card-field">
      <span>{label}</span>
      <span className="studio-value-card-color">
        <i style={{ background: previewColors[value] ?? `var(--studio-color-${value})` }} aria-hidden="true" />
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** A border: its width (1 to 4 pixels) and colour. */
export function BorderCard({ x, y, title, config, onSet, onClose }: { x: number; y: number; title: string; config?: StudioConfig; onSet(text: string): void; onClose(): void }) {
  const [width, setWidth] = useState(1);
  const [color, setColor] = useState("border");
  return (
    <ValueCard x={x} y={y} title={title} onClose={onClose}>
      <div className="studio-value-card-form">
        <label className="studio-value-card-field">
          <span>Width</span>
          <span className="studio-value-card-segments" role="group" aria-label="Width">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" aria-pressed={width === n} onClick={() => setWidth(n)}>
                {n}px
              </button>
            ))}
          </span>
        </label>
        <ColorSelect label="Colour" value={color} config={config} onChange={setColor} />
        <div className="studio-value-card-preview" style={{ border: `${width}px solid ${previewColors[color] ?? `var(--studio-color-${color})`}` }} aria-hidden="true" />
        <button type="button" className="studio-value-card-submit" onClick={() => onSet(`Border(width: ${width}, color: Color.${color})`)}>
          Add border
        </button>
      </div>
    </ValueCard>
  );
}

const GRADIENT_STYLES = ["linear", "radial", "sweep"] as const;
const DIRECTIONS: { label: string; begin: string; end: string }[] = [
  { label: "↓", begin: "top", end: "bottom" },
  { label: "→", begin: "left", end: "right" },
  { label: "↘", begin: "topLeft", end: "bottomRight" },
  { label: "↗", begin: "bottomLeft", end: "topRight" },
];

/** A gradient: two colours or more (add as many as it needs), and how it runs. */
export function GradientCard({ x, y, title, config, onSet, onClose }: { x: number; y: number; title: string; config?: StudioConfig; onSet(text: string): void; onClose(): void }) {
  const [stops, setStops] = useState(["primary", "surface"]);
  const [style, setStyle] = useState<(typeof GRADIENT_STYLES)[number]>("linear");
  const [direction, setDirection] = useState(0);
  const paint = (name: string) => previewColors[name] ?? `var(--studio-color-${name})`;
  const css = useMemo(() => {
    const list = stops.map(paint).join(", ");
    if (style === "radial") return `radial-gradient(circle, ${list})`;
    if (style === "sweep") return `conic-gradient(from 90deg, ${list})`;
    const angle = ["180deg", "90deg", "135deg", "45deg"][direction];
    return `linear-gradient(${angle}, ${list})`;
  }, [stops, style, direction]);
  const text = () => {
    const via = stops.slice(1, -1);
    const parts = [`from: Color.${stops[0]}`, ...(via.length ? [`via: [${via.map((name) => "Color." + name).join(", ")}]`] : []), `to: Color.${stops[stops.length - 1]}`];
    if (style !== "linear") parts.push(`style: GradientStyle.${style}`);
    else if (direction !== 0) parts.push(`begin: Anchor.${DIRECTIONS[direction].begin}`, `end: Anchor.${DIRECTIONS[direction].end}`);
    return `Gradient(${parts.join(", ")})`;
  };
  return (
    <ValueCard x={x} y={y} title={title} onClose={onClose}>
      <div className="studio-value-card-form">
        <div className="studio-value-card-preview is-tall" style={{ backgroundImage: css }} aria-hidden="true" />
        <div className="studio-value-card-segments" role="group" aria-label="Style">
          {GRADIENT_STYLES.map((item) => (
            <button key={item} type="button" aria-pressed={style === item} onClick={() => setStyle(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {style === "linear" && (
          <div className="studio-value-card-segments" role="group" aria-label="Direction">
            {DIRECTIONS.map((item, index) => (
              <button key={item.label} type="button" aria-pressed={direction === index} title={`${item.begin} to ${item.end}`} onClick={() => setDirection(index)}>
                {item.label}
              </button>
            ))}
          </div>
        )}
        <ol className="studio-value-card-stops" aria-label="Colours">
          {stops.map((stop, index) => (
            <li key={index}>
              <ColorSelect
                label={index === 0 ? "From" : index === stops.length - 1 ? "To" : "Then"}
                value={stop}
                config={config}
                onChange={(next) => setStops((list) => list.map((item, at) => (at === index ? next : item)))}
              />
              {stops.length > 2 && (
                <button
                  type="button"
                  className="studio-icon-button"
                  aria-label={`Remove colour ${index + 1}`}
                  onClick={() => setStops((list) => list.filter((_, at) => at !== index))}
                >
                  <MdDeleteOutline />
                </button>
              )}
            </li>
          ))}
        </ol>
        <button type="button" className="studio-value-card-add" onClick={() => setStops((list) => [...list.slice(0, -1), "surfaceAlt", list[list.length - 1]])}>
          <MdAdd aria-hidden="true" /> Add a colour
        </button>
        <button type="button" className="studio-value-card-submit" onClick={() => onSet(text())}>
          Add gradient
        </button>
      </div>
    </ValueCard>
  );
}

/** The data in scope that holds a picture (product.image_url, store.logo_url…). */
export const imageBindings = (bindings: string[]) =>
  bindings.filter((name) => /(image|logo|banner|photo|picture|avatar|thumbnail|icon)(_url)?$|_url$/i.test(name.split(".").pop() ?? ""));

/** Choose the data an image shows: search what's in scope that holds a picture. */
export function ImageDataCard({ x, y, title, bindings, onSet, onClose }: { x: number; y: number; title: string; bindings: string[]; onSet(text: string): void; onClose(): void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const all = imageBindings(bindings);
  const shown = all.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <ValueCard x={x} y={y} title={title} onClose={onClose}>
      <label className="studio-value-card-search">
        <MdSearch aria-hidden="true" />
        <input
          ref={input}
          type="search"
          aria-label="Search data"
          placeholder="Search data with images"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && shown[0]) onSet(shown[0]);
          }}
        />
      </label>
      <ul className="studio-value-card-list" aria-label="Data with images">
        {shown.map((name) => (
          <li key={name}>
            <button type="button" onClick={() => onSet(name)}>
              <code>{name}</code>
            </button>
          </li>
        ))}
      </ul>
      {!shown.length && (
        <p className="studio-value-card-empty">
          {all.length ? `Nothing matches “${query}”.` : "No data with an image is in scope here. Inside a product or store list, its picture is."}
        </p>
      )}
    </ValueCard>
  );
}
