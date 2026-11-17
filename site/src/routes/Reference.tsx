import { useMemo, useState } from "react";
import registry from "../../../registry/registry.json";

/**
 * The widget reference, from the compiler's own registry (registry/registry.json):
 * exactly the names and parameters the checker accepts.
 */
interface Entry {
  name: string;
  group: string;
  parameters: [string, string][];
  required: string[];
}

const ORDER = ["Layout", "Content", "Forms", "Behavior", "Composition", "Actions", "Values", "Library", "Page", "Options", "Structure"];

const entries = [...(registry.constructors as Entry[]), ...(registry.functions as Entry[]).map((f) => ({ ...f, group: f.group || "Functions" }))];
const groups = [...new Set(entries.map((e) => e.group))].sort((a, b) => {
  const ia = ORDER.indexOf(a);
  const ib = ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
});
const tokenFamilies = (registry.tokenFamilies as [string, string[]][]).filter(([name]) => !/Icons$/.test(name));

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function Reference() {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.parameters.some(([p]) => p.toLowerCase() === q)) : entries;
  }, [query]);
  return (
    <>
      <h1>Widget reference</h1>
      <p className="intro">
        Every widget, action and function Flux knows, with its parameters and their types. Required parameters are outlined. This
        page is generated from the compiler's registry, so it's exactly what the checker accepts.
      </p>
      <label htmlFor="filter" className="skip">
        Filter the reference
      </label>
      <input
        id="filter"
        className="filter"
        type="search"
        placeholder={`Filter ${entries.length} entries: Text, onTap, Navigate…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.map((group) => {
        const list = shown.filter((e) => e.group === group);
        if (!list.length) return null;
        return (
          <section key={group}>
            <h2 id={slug(group)}>{group}</h2>
            {list.map((e) => (
              <div className="entry" key={group + e.name} id={slug(e.name)}>
                <h3>{e.name}</h3>
                {e.parameters.length ? (
                  <ul className="params">
                    {e.parameters.map(([name, type]) => (
                      <li key={name} className={e.required.includes(name) ? "req" : undefined}>
                        {name} <span className="type">{type}</span>
                        {e.required.includes(name) && <span className="skip"> (required)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>No parameters.</span>
                )}
              </div>
            ))}
          </section>
        );
      })}
      {!query && (
        <section>
          <h2 id="tokens">Tokens</h2>
          <p>
            Written <code>Family.value</code>: <code>Space.md</code>, <code>Color.primary</code>.
          </p>
          {tokenFamilies.map(([family, values]) => (
            <div className="entry" key={family}>
              <h3>{family}</h3>
              <ul className="tokens params">
                {values.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
