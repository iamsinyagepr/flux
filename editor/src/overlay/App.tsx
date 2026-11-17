// flux dev's editor over the running site. Off, the page is the page. On
// (the Edit switch, or E), hovering a widget outlines it, clicking selects
// it and opens Studio's properties panel beside the page, and right-clicking
// opens Studio's context menu. Every edit rewrites the widget's .flx file
// through flux dev, which rebuilds, and the page updates in place.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeContextMenu } from "../studio/console/components/studio/code-context-menu/CodeContextMenu";
import type { CodeMenuRequest } from "../studio/components/studio/CodeContextMenu";
import { InspectProperties } from "../studio/console/components/studio/inspect-properties/InspectProperties";
import { componentStarters } from "../studio/lib/studio/componentTemplates";
import { parseSource } from "../studio/lib/studio/parser";
import { componentReferences } from "../studio/lib/studio/projectComponents";
import { setActiveProjectConfig } from "../studio/lib/studio/projectConfig";
import { callLocations, deleteNode, insertWidget, locateCall, type SourceEdit } from "../studio/lib/studio/sourceEdits";
import { Conflict, getProject, saveSource, subscribe, type ProjectState } from "../host/channel";
import { boxOf, elementFor, markedElementAt, parentMarked, parseMark, ATTRIBUTE, type Box, type Mark } from "./marks";

const COMPONENT_PREFIX = "component:";
const remembered = (key: string) => {
  try {
    return sessionStorage.getItem("flux-editor:" + key);
  } catch {
    return null;
  }
};
const remember = (key: string, value: string | null) => {
  try {
    if (value === null) sessionStorage.removeItem("flux-editor:" + key);
    else sessionStorage.setItem("flux-editor:" + key, value);
  } catch {
    /* not remembered */
  }
};

interface Menu {
  mark: Mark;
  request: CodeMenuRequest;
  only?: "add";
}

export function App({ host }: { host: HTMLElement }) {
  const [project, setProject] = useState<ProjectState>();
  const [editing, setEditing] = useState(() => remembered("editing") === "1");
  const [hover, setHover] = useState<Box>();
  const [selected, setSelected] = useState<Mark | undefined>(() => parseMark(remembered("selected")));
  const [selectedBox, setSelectedBox] = useState<Box>();
  const [menu, setMenu] = useState<Menu>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const latest = useRef<ProjectState>();
  latest.current = project;

  const refresh = useCallback(() => {
    getProject()
      .then((next) => {
        setProject(next);
        setError("");
      })
      .catch((problem) => setError(problem instanceof Error ? problem.message : "flux dev isn't answering."));
  }, []);
  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  useEffect(() => remember("editing", editing ? "1" : null), [editing]);
  useEffect(() => remember("selected", selected ? `${selected.documentId}:${selected.from}:${selected.to}` : null), [selected]);

  const sources = useMemo(() => Object.fromEntries((project?.files ?? []).map((f) => [f.documentId, f.source])), [project]);
  const componentSources = useMemo(
    () =>
      Object.fromEntries(
        (project?.files ?? []).filter((f) => f.documentId.startsWith(COMPONENT_PREFIX)).map((f) => [f.documentId.slice(COMPONENT_PREFIX.length), f.source]),
      ),
    [project],
  );
  const pageSources = useMemo(
    () => Object.fromEntries((project?.pages ?? []).map((p) => [p.id, sources[p.id] ?? ""])),
    [project, sources],
  );
  const components = useMemo(() => {
    // The language service reads the project's own tokens from here.
    setActiveProjectConfig(project?.config);
    return componentReferences(componentSources);
  }, [project?.config, componentSources]);
  const pagePaths = useMemo(() => (project?.pages ?? []).map((p) => p.path).filter((path) => !path.includes("$")), [project]);
  const currentComponent = (documentId: string) =>
    documentId.startsWith(COMPONENT_PREFIX) ? documentId.slice(COMPONENT_PREFIX.length) : undefined;
  const fileOf = (documentId: string) => project?.files.find((f) => f.documentId === documentId);

  /** Saves an edit made on documentId's source, then selects what it selected. */
  const apply = useCallback((documentId: string, edit: SourceEdit) => {
    const state = latest.current;
    const before = state?.files.find((f) => f.documentId === documentId)?.source;
    if (!state || before === undefined) return;
    // At once, here; the page follows when flux dev has rebuilt.
    setProject({ ...state, files: state.files.map((f) => (f.documentId === documentId ? { ...f, source: edit.source } : f)) });
    setSelected((current) => reselect(documentId, edit, current));
    setSaving(true);
    saveSource(documentId, edit.source, before)
      .then(() => setError(""))
      .catch((problem) => {
        setError(
          problem instanceof Conflict
            ? "That file changed on disk while you were editing it. It's been reloaded: make the change again."
            : problem instanceof Error
              ? problem.message
              : "The change couldn't be saved.",
        );
        refresh();
      })
      .finally(() => setSaving(false));
  }, [refresh]);

  // The selection's outline follows the page as it reflows and rebuilds.
  useEffect(() => {
    if (!selected) return setSelectedBox(undefined);
    let frame = 0;
    const track = () => {
      const element = elementFor(selected);
      setSelectedBox(element ? boxOf(element) : undefined);
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  // The page's own events, while editing.
  useEffect(() => {
    const ours = (event: Event) => event.composedPath().includes(host);
    const onMove = (event: MouseEvent) => {
      if (!editing || ours(event)) return setHover(undefined);
      const element = markedElementAt(event.target);
      setHover(element ? boxOf(element) : undefined);
    };
    const onClick = (event: MouseEvent) => {
      if (!editing || ours(event)) return;
      const element = markedElementAt(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      // Alt-click: the widget it's in.
      const target = event.altKey ? parentMarked(element) ?? element : element;
      const mark = parseMark(target.getAttribute(ATTRIBUTE));
      if (mark && confirmed(mark)) setSelected(mark);
      setMenu(undefined);
    };
    const onMenu = (event: MouseEvent) => {
      if (!editing || ours(event)) return;
      const element = markedElementAt(event.target);
      const mark = element && parseMark(element.getAttribute(ATTRIBUTE));
      if (!mark) return;
      event.preventDefault();
      event.stopPropagation();
      if (!confirmed(mark)) return;
      setSelected(mark);
      openMenu(mark, event.clientX, event.clientY);
    };
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (event.key === "Escape") {
        if (menu) setMenu(undefined);
        else setSelected(undefined);
      } else if (!typing && !ours(event) && (event.key === "e" || event.key === "E") && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setEditing((on) => !on);
      }
    };
    // Capture: before the page's own handlers (a link, a button).
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("contextmenu", onMenu, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("contextmenu", onMenu, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Whether a mark is a widget in its source as it is now. A page loaded
   * while flux dev was still rebuilding can carry an older build's marks,
   * which would point an edit at the wrong place: those are never used.
   */
  function confirmed(mark: Mark): boolean {
    const source = latest.current?.files.find((f) => f.documentId === mark.documentId)?.source;
    let ok = false;
    try {
      ok = source !== undefined && !!locateCall(source, mark);
    } catch {
      ok = false;
    }
    if (!ok) {
      setError("The page is still catching up with the last change. Try again in a moment.");
      refresh();
      setTimeout(() => location.reload(), 600);
    }
    return ok;
  }

  function openMenu(mark: Mark, x: number, y: number, only?: "add") {
    const source = latest.current?.files.find((f) => f.documentId === mark.documentId)?.source;
    if (source === undefined || !confirmed(mark)) return;
    const context = { components, currentComponent: currentComponent(mark.documentId) };
    const text = () => source.slice(mark.from, mark.to);
    const insertAfter = (snippet: string) => apply(mark.documentId, insertWidget(source, { from: mark.from, to: mark.to }, "after", snippet, context));
    setMenu({
      mark,
      only,
      request: {
        x,
        y,
        offset: mark.from,
        from: mark.from,
        to: mark.to,
        actions: {
          copy: () => void navigator.clipboard?.writeText(text()),
          cut: () => {
            void navigator.clipboard?.writeText(text());
            try {
              apply(mark.documentId, deleteNode(source, { from: mark.from, to: mark.to }, context));
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : "That couldn't be cut.");
            }
          },
          paste: () =>
            void navigator.clipboard
              ?.readText()
              .then((snippet) => snippet.trim() && insertAfter(snippet.trim()))
              .catch((problem) => setError(problem instanceof Error ? problem.message : "That couldn't be pasted.")),
          selectAll: () => undefined,
        },
      },
    });
  }

  const inspected = useMemo(() => {
    if (!selected) return undefined;
    const source = sources[selected.documentId];
    if (source === undefined) return undefined;
    try {
      const node = locateCall(source, selected)?.node;
      return node && { node, root: parseSource(source).root ?? undefined, source };
    } catch {
      return undefined;
    }
  }, [selected, sources]);
  const selectedFile = selected && fileOf(selected.documentId);
  // The panel beside the page, never over it: the page gives it room.
  const panelOpen = editing && !!inspected;
  useEffect(() => {
    if (!panelOpen || window.innerWidth < 900) return;
    // A stylesheet of the document's own, not a style attribute: React owns
    // <html>'s attributes, and one it didn't render is a hydration mismatch.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("html { margin-right: 384px !important; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    };
  }, [panelOpen]);
  const label = (documentId: string) =>
    currentComponent(documentId) ?? project?.pages.find((p) => p.id === documentId)?.name ?? (documentId === "shared-shell" ? "Shell" : "Page");

  return (
    <div className="studio-root flux-overlay" data-editing={editing || undefined}>
      {editing && hover && <div className="flux-box is-hover" style={boxStyle(hover)} />}
      {editing && selectedBox && <div className="flux-box is-selected" style={boxStyle(selectedBox)} />}

      {editing && inspected && selected && (
        <aside className="flux-panel" aria-label="Properties">
          <p className="flux-panel-file" title={selectedFile?.path}>
            {selectedFile?.path}
          </p>
          <InspectProperties
            node={inspected.node}
            root={inspected.root}
            source={inspected.source}
            documentLabel={label(selected.documentId)}
            components={components}
            currentComponent={currentComponent(selected.documentId)}
            config={project?.config}
            diagnostics={project?.diagnostics[selected.documentId] ?? []}
            pagePaths={pagePaths}
            readOnly={false}
            onEdit={(edit) => apply(selected.documentId, edit)}
            onError={setError}
            onShowCode={() => setError(`It's in ${selectedFile?.path ?? "the project"}: open it in your editor.`)}
            onClose={() => setSelected(undefined)}
            onSelect={(range) => setSelected({ documentId: selected.documentId, ...range })}
            onAddChild={(x, y) => openMenu(selected, x, y, "add")}
          />
        </aside>
      )}

      {menu && sources[menu.mark.documentId] !== undefined && (
        <CodeContextMenu
          request={menu.request}
          source={sources[menu.mark.documentId]}
          documentId={menu.mark.documentId}
          components={components}
          currentComponent={currentComponent(menu.mark.documentId)}
          componentSources={componentSources}
          pageSources={pageSources}
          templates={componentStarters.filter((template) => !template.blank)}
          onImportTemplate={() => {
            throw new Error("Add components as files in components/: flux dev doesn't import Studio's library yet.");
          }}
          readOnly={false}
          onEdit={(edit) => apply(menu.mark.documentId, edit)}
          onError={setError}
          config={project?.config}
          onClose={() => setMenu(undefined)}
          only={menu.only}
        />
      )}

      <div className="flux-bar" role="toolbar" aria-label="Flux editor">
        <button
          type="button"
          className="flux-switch"
          aria-pressed={editing}
          onClick={() => {
            setEditing((on) => !on);
            setMenu(undefined);
          }}
          title="Edit the page (E)"
        >
          <span className="flux-dot" aria-hidden="true" />
          {editing ? "Editing" : "Edit"}
        </button>
        {editing && (
          <span className="flux-hint">
            {saving ? "Saving…" : selected ? "Alt-click: the widget around it · Esc: deselect" : "Click a widget to edit it · right-click for more"}
          </span>
        )}
      </div>
      {error && (
        <p className="flux-error" role="alert">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * The widget to keep selected after an edit. An edit's selection is where
 * Studio's editor puts the cursor (often an argument inside the widget), so
 * the widget is found again: the one starting where the selected one did
 * (an argument changed inside it), else the innermost one around the cursor
 * (a widget added, wrapped or replaced), else none.
 */
function reselect(documentId: string, edit: SourceEdit, current: Mark | undefined): Mark | undefined {
  try {
    const root = parseSource(edit.source).root;
    if (!root) return undefined;
    const calls = callLocations(root).map(({ node }) => node);
    if (current?.documentId === documentId) {
      const same = calls.find((node) => node.from === current.from);
      if (same) return { documentId, from: same.from, to: same.to };
    }
    const around = calls
      .filter((node) => node.from <= edit.selection.from && edit.selection.to <= node.to)
      .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
    return around ? { documentId, from: around.from, to: around.to } : undefined;
  } catch {
    return undefined;
  }
}

function boxStyle(box: Box) {
  return { top: box.top - 2, left: box.left - 2, width: box.width + 4, height: box.height + 4 };
}
