// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/ConfigDialog.tsx). Edit it there, then npm run sync.
import { useState } from "react";
import { Select } from '../../../../components/Select';
import type { ConfigTab, ProjectDetails } from "../../../../components/studio/ConfigDialog";
import { StudioPanel } from "../../../../components/studio/StudioChrome";
import { StudioIcon } from "../../../../components/studio/StudioIcon";
import { Arrow, Button, Card } from "../../../../components/ui";
import { pageTransitionLabels, pageTransitions, type PageTransition } from "../../../../lib/studio/pageTransitions";
import { builtInToken, colorVariables, GOOGLE_MAPS_KEY, customTokens, defaultStudioConfig, iconLibraries, iconNames, MAX_CUSTOM_TOKENS, sizeDefaults, usesDarkTheme, validHexColor, validStudioConfig, type IconLibrary, type StudioConfig, type ThemeMode, type TokenGroup } from "../../../../lib/studio/projectConfig";
import { CONFIG_TABS, sizeGroups } from "../../../constants/studio/config-dialog/index";
import { colorDefaults } from "../../../functions/studio/config-dialog/index";
import { AddToken } from "./AddToken";
import { CardHead } from "./CardHead";
import { RemoveButton } from "./RemoveButton";
import { ResetButton } from "./ResetButton";
import { TabButton } from "./TabButton";
import { AppIdentity } from "./AppIdentity";
import type { Business } from "../../../../api/types";

export function ConfigDialog({
  config,
  theme,
  details,
  facts,
  onApply,
  onClose,
  readOnly,
  business,
}: {
  /** A business's own app: its icon and name are under App. */
  business?: Business;
  config?: StudioConfig;
  theme: "light" | "dark";
  /** The project's own name and description, edited alongside its tokens. */
  details: ProjectDetails;
  /** Read-only facts about the project, shown under Details. */
  facts: { label: string; value: string }[];
  onApply: (config: StudioConfig, details: ProjectDetails) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(() =>
    structuredClone(config ?? defaultStudioConfig()),
  );
  const [about, setAbout] = useState(details);
  const [tab, setTab] = useState<ConfigTab>("details");
  const [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState("cart"),
    [copied, setCopied] = useState("");
  // The palette being edited; opens on the one the preview is showing.
  const [palette, setPalette] = useState<"light" | "dark">(theme);
  const paletteGroup = palette === "light" ? "colors" : "darkColors";
  const colors: Record<string, string> = (palette === "light" ? draft.colors : draft.darkColors) ?? {};
  const defaults = colorDefaults(palette);
  const usage = `Icon(name: ${iconLibraries[draft.iconLibrary].namespace}.${selected}, size: Size.md, color: Color.primary)`;
  const matches = iconNames.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function reset(group: keyof typeof sizeDefaults | "colors" | "darkColors", name: string) {
    setDraft((previous) => {
      const values: Record<string, unknown> = { ...previous[group] };
      delete values[name];
      return { ...previous, [group]: values };
    });
    setError("");
  }
  function setColor(name: string, value: string) {
    setDraft((previous) => ({
      ...previous,
      [paletteGroup]: { ...previous[paletteGroup], [name]: value },
    }));
  }
  /** A custom colour goes from both palettes: dark can't keep a token light doesn't define. */
  function removeCustomColor(name: string) {
    setDraft((previous) => {
      const colors = { ...previous.colors };
      const darkColors = { ...previous.darkColors };
      delete colors[name];
      delete darkColors[name];
      return { ...previous, colors, darkColors };
    });
    setError("");
  }
  return (
    <StudioPanel
      title="Project config"
      onClose={onClose}
      className="studio-config"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly) return;
          if (!about.name.trim()) {
            setTab("details");
            setError("Give the project a name.");
            return;
          }
          if (draft.googleMapsKey && !GOOGLE_MAPS_KEY.test(draft.googleMapsKey)) {
            setError("The Google Maps display key isn't one Google gives: check it under Maps.");
            return;
          }
          if (!validStudioConfig(draft)) {
            setError(
              "Use six-digit HEX colors and sizes within the displayed ranges.",
            );
            return;
          }
          onApply(draft, { ...about, name: about.name.trim() });
          onClose();
        }}
        className="grid gap-6 md:grid-cols-[150px_minmax(0,1fr)]"
      >
        <div className="relative">
          <div
            role="group"
            aria-label="Config categories"
            className="sticky top-6 flex gap-1 max-md:flex-wrap md:flex-col md:gap-4"
          >
            {CONFIG_TABS.filter((item) => item.key !== "app" || business).map((item) => (
              <TabButton
                key={item.key}
                icon={item.icon}
                active={tab === item.key}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </TabButton>
            ))}
          </div>
        </div>

        <div className="studio-form-column min-w-0 space-y-6">
          {tab === "app" && business && <AppIdentity business={business} />}
          {tab === "details" && (
            <>
              <Card>
                <CardHead title="Project" />
                <div className="space-y-4">
                  <label className="studio-config-field">
                    <span>Project name</span>
                    <input
                      value={about.name}
                      maxLength={60}
                      readOnly={readOnly}
                      onChange={(event) =>
                        setAbout({ ...about, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="studio-config-field">
                    <span>Description</span>
                    <textarea
                      rows={4}
                      value={about.description}
                      maxLength={200}
                      readOnly={readOnly}
                      onChange={(event) =>
                        setAbout({ ...about, description: event.target.value })
                      }
                    />
                  </label>
                </div>
              </Card>
              <Card>
                <CardHead title="Page transitions" />
                <label className="studio-config-field max-w-sm">
                  <span>Transition</span>
                  <Select look="studio"
                    aria-label="Page transition"
                    value={draft.pageTransition ?? "platform"}
                    disabled={readOnly}
                    onChange={(event) => {
                      const value = event.target.value as PageTransition;
                      setDraft(({ pageTransition: _, ...previous }) =>
                        value === "platform" ? previous : { ...previous, pageTransition: value },
                      );
                    }}
                  >
                    {pageTransitions.map((transition) => (
                      <option key={transition} value={transition}>
                        {pageTransitionLabels[transition]}
                      </option>
                    ))}
                  </Select>
                </label>
              </Card>
              <Card>
                <CardHead title="About this project" />
                <dl className="studio-config-facts">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </>
          )}

          {tab === "colors" && (
            <>
            <Card>
              <CardHead title="Theme" />
              <label className="studio-config-field max-w-sm">
                <span>App theme</span>
                <Select look="studio"
                  aria-label="App theme"
                  value={draft.themeMode ?? "light"}
                  disabled={readOnly}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, themeMode: event.target.value as ThemeMode }))
                  }
                >
                  <option value="light">Light only</option>
                  <option value="system">Follow the device</option>
                  <option value="dark">Dark</option>
                </Select>
              </label>
            </Card>
            <Card>
              <CardHead title="Colors" />
              <div role="group" aria-label="Palette" className="mb-5 gap-1 flex ">
                {(["light", "dark"] as const).map((item) => (
                  <TabButton key={item} active={palette === item} onClick={() => setPalette(item)}>
                    {item === "light" ? "Light" : "Dark"}
                  </TabButton>
                ))}
              </div>
              {palette === "dark" && !usesDarkTheme(draft) && (
                <p className="studio-muted mb-4 text-xs">
                  The app is Light only, so this palette shows in the preview
                  but isn't built into the app until App theme allows dark.
                </p>
              )}
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {Object.keys(colorVariables).map((name) => {
                  const value = colors[name] ?? defaults[name];
                  return (
                    <div className="studio-config-color" key={name}>
                      <input
                        type="color"
                        aria-label={`Pick Color.${name}`}
                        value={validHexColor(value) ? value : defaults[name]}
                        disabled={readOnly}
                        onChange={(event) => setColor(name, event.target.value)}
                      />
                      <label className="studio-config-field min-w-0 flex-1">
                        <span className="font-mono">Color.{name}</span>
                        <input
                          type="text"
                          aria-label={`Color.${name}`}
                          className="font-mono"
                          value={value}
                          maxLength={7}
                          placeholder="#abcdef"
                          readOnly={readOnly}
                          onChange={(event) => setColor(name, event.target.value)}
                        />
                      </label>
                      <ResetButton
                        label={`Reset Color.${name}`}
                        disabled={readOnly || !Object.hasOwn(colors, name)}
                        onClick={() => reset(paletteGroup, name)}
                      />
                    </div>
                  );
                })}
                {customTokens(draft, "colors").map((name) => {
                  // In dark, a custom token is its light value until set.
                  const own = colors[name];
                  const value = own ?? draft.colors[name];
                  return (
                    <div className="studio-config-color" key={name}>
                      <input
                        type="color"
                        aria-label={`Pick Color.${name}`}
                        value={validHexColor(value) ? value : "#000000"}
                        disabled={readOnly}
                        onChange={(event) => setColor(name, event.target.value)}
                      />
                      <label className="studio-config-field min-w-0 flex-1">
                        <span className="font-mono">
                          Color.{name} <em>{palette === "dark" && own === undefined ? "custom, same as light" : "custom"}</em>
                        </span>
                        <input
                          type="text"
                          aria-label={`Color.${name}`}
                          className="font-mono"
                          value={value}
                          maxLength={7}
                          placeholder="#abcdef"
                          readOnly={readOnly}
                          onChange={(event) => setColor(name, event.target.value)}
                        />
                      </label>
                      {palette === "light" ? (
                        <RemoveButton
                          label={`Remove Color.${name}`}
                          disabled={readOnly}
                          onClick={() => removeCustomColor(name)}
                        />
                      ) : (
                        <ResetButton
                          label={`Reset Color.${name}`}
                          disabled={readOnly || own === undefined}
                          onClick={() => reset("darkColors", name)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Custom tokens are defined once, in the light palette, and
                  exist in both; dark only overrides their value. */}
              {palette === "light" && (
                <AddToken
                  family="Color"
                  kind="color"
                  taken={(name) =>
                    builtInToken("colors", name) || Object.hasOwn(draft.colors, name)
                  }
                  full={customTokens(draft, "colors").length >= MAX_CUSTOM_TOKENS}
                  disabled={readOnly}
                  onAdd={(name, value) => setColor(name, String(value))}
                />
              )}
            </Card>
            </>
          )}

          {tab === "sizes" &&
            Object.entries(sizeGroups).map(([groupName, group]) => {
              const key = groupName as keyof typeof sizeDefaults;
              return (
                <Card key={key}>
                  <CardHead title={group.label}>
                    {group.min}–{group.max}
                  </CardHead>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(sizeDefaults[key]).map(([name, fallback]) => (
                      <div className="flex items-end gap-2" key={name}>
                        <label className="studio-config-field min-w-0 flex-1">
                          <span className="font-mono">
                            {group.family}.{name}
                          </span>
                          <input
                            type="number"
                            aria-label={`${group.family}.${name}`}
                            min={group.min}
                            max={group.max}
                            step="any"
                            value={draft[key][name] ?? fallback}
                            disabled={readOnly}
                            onChange={(event) => {
                              if (event.target.value === "") reset(key, name);
                              else
                                setDraft((previous) => ({
                                  ...previous,
                                  [key]: {
                                    ...previous[key],
                                    [name]: Number(event.target.value),
                                  },
                                }));
                            }}
                          />
                        </label>
                        <ResetButton
                          label={`Reset ${group.family}.${name}`}
                          disabled={readOnly || !Object.hasOwn(draft[key], name)}
                          onClick={() => reset(key, name)}
                        />
                      </div>
                    ))}
                    {customTokens(draft, key).map((name) => (
                      <div className="flex items-end gap-2" key={name}>
                        <label className="studio-config-field min-w-0 flex-1">
                          <span className="font-mono">
                            {group.family}.{name} <em>custom</em>
                          </span>
                          <input
                            type="number"
                            aria-label={`${group.family}.${name}`}
                            min={group.min}
                            max={group.max}
                            step="any"
                            value={draft[key][name]}
                            disabled={readOnly}
                            onChange={(event) => {
                              // Clearing the box must not delete the variable;
                              // Remove does that.
                              if (event.target.value === "") return;
                              setDraft((previous) => ({
                                ...previous,
                                [key]: {
                                  ...previous[key],
                                  [name]: Number(event.target.value),
                                },
                              }));
                            }}
                          />
                        </label>
                        <RemoveButton
                          label={`Remove ${group.family}.${name}`}
                          disabled={readOnly}
                          onClick={() => reset(key, name)}
                        />
                      </div>
                    ))}
                  </div>
                  <AddToken
                    family={group.family}
                    kind="size"
                    min={group.min}
                    max={group.max}
                    taken={(name) =>
                      builtInToken(key, name) || Object.hasOwn(draft[key], name)
                    }
                    full={customTokens(draft, key).length >= MAX_CUSTOM_TOKENS}
                    disabled={readOnly}
                    onAdd={(name, value) =>
                      setDraft((previous) => ({
                        ...previous,
                        [key]: { ...previous[key], [name]: Number(value) },
                      }))
                    }
                  />
                </Card>
              );
            })}

          {tab === "maps" && (
            <>
              <Card>
                <CardHead title="Google Maps display key">
                  GoogleMap (the Library) draws its maps with this key. It
                  ships inside the app and the website, as every map key does,
                  so it is public by design: restrict it in Google Cloud to
                  this project's website address and its Android and iOS
                  apps, and to the Maps JavaScript API and the Maps SDKs for
                  Android and iOS.
                </CardHead>
                <label className="studio-config-field max-w-xl">
                  <span>Display key</span>
                  <input
                    aria-label="Google Maps display key"
                    value={draft.googleMapsKey ?? ""}
                    disabled={readOnly}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="AIza…"
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      setDraft(({ googleMapsKey: _, ...previous }) => (value ? { ...previous, googleMapsKey: value } : previous));
                    }}
                  />
                  {draft.googleMapsKey && !GOOGLE_MAPS_KEY.test(draft.googleMapsKey) && (
                    <small className="studio-error">A Google key is letters, digits, - and _ (20 to 100 of them).</small>
                  )}
                </label>
                <p className="text-sm leading-relaxed text-steel">
                  Without it, GoogleMap shows where the map goes in the
                  preview and says the map is unavailable in the app and on
                  the website.
                </p>
              </Card>
              <Card>
                <CardHead title="Address search">
                  SearchPlaces, ChoosePlace and SearchStores search addresses
                  and find nearby stores through your instance's API, with the
                  instance's own key, which never leaves the server.
                </CardHead>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-steel">
                  <li>
                    Set the instance's key under <strong>Instance → Maps and
                    search</strong> in the business console. It shows how to
                    restrict it to the two APIs it uses.
                  </li>
                  <li>
                    Without a key the instance's search is off, so a connected
                    app can't find addresses; an app with no instance connected
                    offers sample places instead.
                  </li>
                  <li>
                    Never paste the instance's key here or into your source:
                    it isn't restricted to your app, and anything in an app can
                    be read out of it.
                  </li>
                </ul>
              </Card>
            </>
          )}

          {tab === "icons" && (
            <>
              <Card>
                <CardHead title="Default icon library" />
                <label className="studio-config-field max-w-sm">
                  <span>Library</span>
                  <Select look="studio"
                    aria-label="Default icon library"
                    value={draft.iconLibrary}
                    disabled={readOnly}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        iconLibrary: event.target.value as IconLibrary,
                      }))
                    }
                  >
                    {Object.entries(iconLibraries).map(([id, library]) => (
                      <option value={id} key={id}>
                        {library.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </Card>
              <Card>
                <CardHead title="Icon browser" />
                <label className="studio-config-field max-w-sm">
                  <span>Find an icon</span>
                  <input
                    type="search"
                    aria-label="Find an icon"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search icons"
                  />
                </label>
                <div className="studio-config-icons mt-5">
                  {matches.map((name) => (
                    <button
                      type="button"
                      key={name}
                      aria-label={`Use ${iconLibraries[draft.iconLibrary].namespace}.${name}`}
                      aria-pressed={selected === name}
                      onClick={() => {
                        setSelected(name);
                        setCopied("");
                      }}
                    >
                      <StudioIcon
                        token={`Icons.${name}`}
                        library={draft.iconLibrary}
                        aria-hidden="true"
                      />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
                {!matches.length && (
                  <p role="status" className="mt-4 text-sm text-steel">
                    No icons match this search.
                  </p>
                )}
                <div className="studio-config-usage mt-5">
                  <code>{usage}</code>
                  <button
                    type="button"
                    className="studio-text-button"
                    onClick={() => {
                      void navigator.clipboard.writeText(usage).then(
                        () => setCopied("Usage copied"),
                        () =>
                          setCopied("Select the usage above to copy it manually"),
                      );
                    }}
                  >
                    Copy usage
                  </button>
                </div>
                {copied && (
                  <p role="status" className="mt-2 text-xs text-steel">
                    {copied}
                  </p>
                )}
              </Card>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {error && (
              <p className="studio-error w-full" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={readOnly}>
              Apply config <Arrow className="text-accent" />
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={readOnly}
              className="ml-auto"
              onClick={() => {
                // Built-in tokens go back to the theme defaults; variables
                // the project added stay (Remove deletes those).
                setDraft((previous) => {
                  const next = defaultStudioConfig();
                  for (const group of ["colors", "spacing", "radii", "fontSizes", "iconSizes"] as TokenGroup[])
                    for (const name of customTokens(previous, group))
                      (next[group] as Record<string, string | number>)[name] = previous[group][name];
                  return next;
                });
                setError("");
              }}
            >
              Reset defaults
            </Button>
          </div>
        </div>
      </form>
    </StudioPanel>
  );
}

export default ConfigDialog;
