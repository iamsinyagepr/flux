// flux dev's editor over the running site. Its one control is a round
// button with Upskale's mark (Launcher): editing on or off, the page's tree,
// the theme, and data lists to add.
//
// Editing, hovering a widget outlines it and clicking selects it; Shift
// (or Ctrl) + click selects several, which can be wrapped together, moved
// into another widget or deleted (MultiBar). A selected widget can be
// dragged before, after or into another. Right-clicking opens Studio's
// context menu; Ctrl+right-click, the widget's properties; a property opens
// on its own card (PropertyCard), saved with Done.
//
// Every edit rewrites a .flx file through flux dev, which rebuilds, and the
// page updates in place.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeContextMenu } from "../studio/console/components/studio/code-context-menu/CodeContextMenu";
import type { CodeMenuRequest } from "../studio/components/studio/CodeContextMenu";
import StudioContextMenu, { type MenuItem } from "../studio/components/studio/StudioContextMenu";
import { ConfigDialog } from "../studio/console/components/studio/config-dialog/ConfigDialog";
import { componentStarters } from "../studio/lib/studio/componentTemplates";
import { migrateImports } from "../studio/lib/studio/migrateImports";
import { parseSource } from "../studio/lib/studio/parser";
import { componentReferences } from "../studio/lib/studio/projectComponents";
import { setActiveProjectConfig, type StudioConfig } from "../studio/lib/studio/projectConfig";
import { moveSourceBlock, type DropPlacement } from "../studio/lib/studio/sourceMoves";
import {
  addDataImport,
  callLocations,
  definitionOf,
  deleteNode,
  deleteNodes,
  insertWidget,
  locateCall,
  moveNodesInto,
  widgetSlots,
  wrapNodes,
  type MultiWrapper,
  type SourceEdit,
} from "../studio/lib/studio/sourceEdits";
import { nodeLabel, propertyRows } from "../studio/lib/studio/visualModel";
import { Conflict, getProject, saveConfig, saveSource, subscribe, type ProjectState } from "../host/channel";
import { imports, storeFor, type DataList } from "./dataLists";
import { Launcher } from "./Launcher";
import { boxOf, elementFor, markedElementAt, markValue, parentMarked, parseMark, ATTRIBUTE, type Box, type Mark } from "./marks";
import { MultiBar, type MoveTarget } from "./MultiBar";
import { PropertyCard, type PropertyCardRequest } from "./PropertyCard";
import { Tree, type TreeDocument } from "./Tree";

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
const same = (a: Mark, b: Mark) => a.documentId === b.documentId && a.from === b.from && a.to === b.to;

interface Menu {
  mark: Mark;
  request: CodeMenuRequest;
  only?: "add";
}

/** A drag under way: the widget, and where it would go. */
interface Drag {
  mark: Mark;
  label: string;
  x: number;
  y: number;
  target?: { mark: Mark; placement: DropPlacement; box: Box; horizontal: boolean };
}

export function App({ host }: { host: HTMLElement }) {
  const [project, setProject] = useState<ProjectState>();
  const [editing, setEditing] = useState(() => remembered("editing") === "1");
  const [hover, setHover] = useState<Box>();
  // What's selected: one widget, or several in one file. The last is the one
  // a card or the menu is about.
  const [selection, setSelection] = useState<Mark[]>(() =>
    (remembered("selection") ?? "").split("|").map(parseMark).filter((mark): mark is Mark => !!mark),
  );
  const [boxes, setBoxes] = useState<(Box | undefined)[]>([]);
  const [menu, setMenu] = useState<Menu>();
  // Ctrl+right-click: the widget's properties, at the pointer.
  const [properties, setProperties] = useState<{ mark: Mark; x: number; y: number }>();
  // One property on its card, beside the widget.
  const [card, setCard] = useState<PropertyCardRequest>();
  const [treeOpen, setTreeOpen] = useState(() => remembered("tree") === "1");
  const [themeOpen, setThemeOpen] = useState(false);
  // A widget outlined from elsewhere: a row of the tree, a Move to target.
  const [pointed, setPointed] = useState<Mark>();
  const [pointedBox, setPointedBox] = useState<Box>();
  const [drag, setDrag] = useState<Drag>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const latest = useRef<ProjectState>();
  latest.current = project;
  const primary = selection.at(-1);
  const setSelected = (mark: Mark | undefined) => setSelection(mark ? [mark] : []);

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
  useEffect(() => remember("tree", treeOpen ? "1" : null), [treeOpen]);
  useEffect(() => remember("selection", selection.length ? selection.map(markValue).join("|") : null), [selection]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

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
  const contextFor = (documentId: string) => ({ components, currentComponent: currentComponent(documentId) });
  const fileOf = (documentId: string) => project?.files.find((f) => f.documentId === documentId);
  const isPage = (documentId: string) => !!project?.pages.some((page) => page.id === documentId);
  const labelOf = (documentId: string) =>
    currentComponent(documentId) ?? project?.pages.find((p) => p.id === documentId)?.name ?? (documentId === "shared-shell" ? "Shell" : "Page");
  const fail = (problem: unknown, otherwise: string) => setError(problem instanceof Error ? problem.message : otherwise);

  /**
   * Saves an edit made on documentId's source, then selects what it
   * selected (or `select`). A page's source first gets any import it now
   * needs (migrateImports): a widget reading the cart, a store or a menu
   * brings its data with it.
   */
  const apply = useCallback(
    (documentId: string, edit: SourceEdit, select?: Mark[]) => {
      const state = latest.current;
      const before = state?.files.find((f) => f.documentId === documentId)?.source;
      if (!state || before === undefined) return;
      let source = edit.source;
      if (state.pages.some((page) => page.id === documentId)) {
        try {
          source = migrateImports(source);
        } catch {
          /* left as the edit made it: the checker says what's missing */
        }
      }
      const shifted = source === edit.source ? edit : { source, selection: edit.selection };
      // At once, here; the page follows when flux dev has rebuilt.
      setProject({ ...state, files: state.files.map((f) => (f.documentId === documentId ? { ...f, source } : f)) });
      setSelection((current) => select ?? (() => {
        const kept = reselect(documentId, shifted, current.at(-1));
        return kept ? [kept] : [];
      })());
      setSaving(true);
      saveSource(documentId, source, before)
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
    },
    [refresh],
  );

  // The selection's outlines follow the page as it reflows and rebuilds;
  // so does a widget outlined from the tree or a Move to list.
  useEffect(() => {
    if (!selection.length && !pointed) {
      setBoxes([]);
      setPointedBox(undefined);
      return;
    }
    let frame = 0;
    const track = () => {
      setBoxes(selection.map((mark) => {
        const element = elementFor(mark);
        return element ? boxOf(element) : undefined;
      }));
      const element = pointed && elementFor(pointed);
      setPointedBox(element ? boxOf(element) : undefined);
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [selection, pointed]);

  // Not until the project has loaded (nothing to check a widget against),
  // nor while the latest build failed (the page isn't what's on disk).
  const pausedNow = () => !latest.current || latest.current.failing.length > 0;

  /**
   * Whether a mark is a widget in its source as it is now (where an edit is
   * made). Between a save and the rebuild it reaches the page, the page's
   * marks are the last build's and can point elsewhere: those are never
   * used. It says so once; the page catches up by itself.
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
      setError("The page is a moment behind its files. Try again once it has updated.");
      refresh();
    }
    return ok;
  }

  /** Clicked: the widget alone, or (Shift, Ctrl) added to or taken from the selection. */
  function select(mark: Mark, add: boolean) {
    if (!confirmed(mark)) return;
    setMenu(undefined);
    setProperties(undefined);
    if (!add) return setSelected(mark);
    setSelection((current) => {
      if (current.length && current[0].documentId !== mark.documentId) {
        setNotice(`Several widgets are selected within one file: this one is in ${labelOf(mark.documentId)}.`);
        return [mark];
      }
      return current.some((item) => same(item, mark)) ? current.filter((item) => !same(item, mark)) : [...current, mark];
    });
  }

  // --- Dragging a selected widget -------------------------------------------------
  const pressed = useRef<{ mark: Mark; x: number; y: number } | undefined>(undefined);
  const swallowClick = useRef(false);
  const dragRef = useRef<Drag | undefined>(undefined);
  dragRef.current = drag;

  /** Where a widget dragged over `element` would go: before, after or inside it. */
  function dropAt(element: HTMLElement, x: number, y: number, dragged: Mark): Drag["target"] {
    const mark = parseMark(element.getAttribute(ATTRIBUTE));
    if (!mark || mark.documentId !== dragged.documentId) return undefined;
    // Not onto itself, nor into itself.
    if (mark.from >= dragged.from && mark.to <= dragged.to) return undefined;
    const box = boxOf(element);
    const source = latest.current?.files.find((f) => f.documentId === mark.documentId)?.source;
    if (!box || source === undefined) return undefined;
    const root = parseSource(source).root;
    const location = root && callLocations(root).find(({ node }) => node.from === mark.from && node.to === mark.to);
    if (!location) return undefined;
    const horizontal = !!location.parent && ["Row", "Wrap"].includes(location.parent.name);
    const takesChildren = widgetSlots(location.node, contextFor(mark.documentId)).some((slot) => slot.list);
    const inMiddle =
      x > box.left + box.width * 0.25 && x < box.left + box.width * 0.75 && y > box.top + box.height * 0.25 && y < box.top + box.height * 0.75;
    let placement: DropPlacement;
    if (takesChildren && (inMiddle || !location.list)) placement = "inside";
    else if (!location.list) return undefined;
    else if (horizontal) placement = x < box.left + box.width / 2 ? "before" : "after";
    else placement = y < box.top + box.height / 2 ? "before" : "after";
    return { mark, placement, box, horizontal };
  }

  function drop(current: Drag) {
    const target = current.target;
    if (!target) return;
    const source = latest.current?.files.find((f) => f.documentId === current.mark.documentId)?.source;
    if (source === undefined) return;
    try {
      const move = moveSourceBlock(
        source,
        current.mark,
        { documentId: target.mark.documentId, from: target.mark.from, to: target.mark.to },
        target.placement,
        components,
        currentComponent(current.mark.documentId),
      );
      apply(current.mark.documentId, move);
    } catch (problem) {
      fail(problem, "That couldn't be moved there.");
    }
  }

  // The page's own events, while editing.
  useEffect(() => {
    const ours = (event: Event) => event.composedPath().includes(host);
    const active = () => editing && !pausedNow();
    const onMove = (event: MouseEvent) => {
      if (!active() || ours(event)) return setHover(undefined);
      const element = markedElementAt(event.target);
      setHover(element ? boxOf(element) : undefined);
    };
    const onDown = (event: PointerEvent) => {
      pressed.current = undefined;
      if (!active() || ours(event) || card || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = markedElementAt(event.target);
      const mark = element && parseMark(element.getAttribute(ATTRIBUTE));
      // Only a widget already selected drags: a click on another selects it.
      if (mark && selection.some((item) => same(item, mark))) pressed.current = { mark, x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      const start = pressed.current;
      if (!start) return;
      const current = dragRef.current;
      if (!current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
      event.preventDefault();
      const source = latest.current?.files.find((f) => f.documentId === start.mark.documentId)?.source;
      const label = (source !== undefined && locateCall(source, start.mark)?.node.name) || "widget";
      const under = document.elementsFromPoint(event.clientX, event.clientY).find((el) => !host.contains(el) && el !== host);
      const element = under ? markedElementAt(under) : undefined;
      setDrag({
        mark: start.mark,
        label,
        x: event.clientX,
        y: event.clientY,
        target: element ? dropAt(element, event.clientX, event.clientY, start.mark) : undefined,
      });
    };
    const onUp = () => {
      const current = dragRef.current;
      pressed.current = undefined;
      if (!current) return;
      swallowClick.current = true;
      setDrag(undefined);
      drop(current);
    };
    const onClick = (event: MouseEvent) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!active() || ours(event)) return;
      const element = markedElementAt(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      // A card is open: Done or Cancel first, so its changes aren't lost.
      if (card) return;
      // Alt-click: the widget it's in.
      const target = event.altKey ? parentMarked(element) ?? element : element;
      const mark = parseMark(target.getAttribute(ATTRIBUTE));
      if (mark) select(mark, event.shiftKey || event.ctrlKey || event.metaKey);
    };
    const onMenu = (event: MouseEvent) => {
      if (!active() || ours(event)) return;
      const element = markedElementAt(event.target);
      const mark = element && parseMark(element.getAttribute(ATTRIBUTE));
      if (!mark) return;
      event.preventDefault();
      event.stopPropagation();
      if (card || !confirmed(mark)) return;
      setSelected(mark);
      setMenu(undefined);
      setProperties(undefined);
      // Ctrl (Cmd on a Mac) + right-click: just its properties.
      if (event.ctrlKey || event.metaKey) setProperties({ mark, x: event.clientX, y: event.clientY });
      else openMenu(mark, event.clientX, event.clientY);
    };
    const onKey = (event: KeyboardEvent) => {
      const path = event.composedPath();
      const typing = path.some((node) => node instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || node.isContentEditable));
      if (event.key === "Escape") {
        // An open card or dialog takes its own Esc.
        if (card || themeOpen) return;
        if (dragRef.current) {
          pressed.current = undefined;
          setDrag(undefined);
        } else if (menu) setMenu(undefined);
        else if (properties) setProperties(undefined);
        else setSelection([]);
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "e" || event.key === "E") setEditing((on) => !on);
      else if (event.key === "t" || event.key === "T") setTreeOpen((on) => !on);
      else if ((event.key === "Delete" || event.key === "Backspace") && active() && selection.length && !card && !ours(event)) {
        event.preventDefault();
        deleteSelection();
      }
    };
    // Capture: before the page's own handlers (a link, a button).
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("contextmenu", onMenu, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("contextmenu", onMenu, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // No text selected, and the hand that drags, while a drag is under way.
  useEffect(() => {
    if (!drag) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("* { user-select: none !important; cursor: grabbing !important; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    };
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  function openMenu(mark: Mark, x: number, y: number, only?: "add") {
    const source = latest.current?.files.find((f) => f.documentId === mark.documentId)?.source;
    if (source === undefined || !confirmed(mark)) return;
    const context = contextFor(mark.documentId);
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
              fail(problem, "That couldn't be cut.");
            }
          },
          paste: () =>
            void navigator.clipboard
              ?.readText()
              .then((snippet) => snippet.trim() && insertAfter(snippet.trim()))
              .catch((problem) => fail(problem, "That couldn't be pasted.")),
          selectAll: () => undefined,
        },
      },
    });
  }

  /** Opens a property's card for the widget at mark: to add it, or to edit it. */
  function openCard(mark: Mark, name: string, adding: boolean) {
    setMenu(undefined);
    setProperties(undefined);
    setSelected(mark);
    setCard({ documentId: mark.documentId, from: mark.from, to: mark.to, name, adding });
  }

  /** The widget's properties as a dropdown: those set, then the ones it can still have. */
  function propertyItems(mark: Mark): MenuItem[] {
    const source = sources[mark.documentId];
    const node = source !== undefined ? locateCall(source, mark)?.node : undefined;
    if (!node || source === undefined) return [{ label: "This widget isn't in its file any more", disabled: true }];
    const { rows, available } = propertyRows(source, node, definitionOf(node, contextFor(mark.documentId)));
    const set = rows.filter((row) => Object.hasOwn(node.args, row.name));
    const written = (name: string) => {
      const text = source.slice(node.args[name].from, node.args[name].to).replace(/\s+/g, " ");
      return text.length > 26 ? text.slice(0, 25) + "…" : text;
    };
    const items: MenuItem[] = set.map((row, index) => ({
      section: index === 0 ? node.name : undefined,
      label: row.name,
      hint: written(row.name),
      onSelect: () => openCard(mark, row.name, false),
    }));
    if (!set.length) items.push({ section: node.name, label: "Nothing set yet", disabled: true });
    if (available.length)
      items.push({
        section: "",
        label: "Add property",
        hint: available.length + " available",
        children: available.map((item) => ({
          label: item.name,
          hint: item.required ? "required" : item.type,
          onSelect: () => openCard(mark, item.name, true),
        })),
      });
    return items;
  }

  // --- Several selected -----------------------------------------------------------
  const multi = selection.length > 1;
  const selectionDoc = selection[0]?.documentId;

  function deleteSelection() {
    const doc = selectionDoc;
    const source = doc !== undefined ? latest.current?.files.find((f) => f.documentId === doc)?.source : undefined;
    if (doc === undefined || source === undefined) return;
    try {
      const edit = selection.length > 1 ? deleteNodes(source, selection) : deleteNode(source, selection[0], contextFor(doc));
      apply(doc, edit, []);
    } catch (problem) {
      fail(problem, "That couldn't be deleted.");
    }
  }

  function wrapSelection(wrapper: MultiWrapper) {
    const doc = selectionDoc;
    const source = doc !== undefined ? sources[doc] : undefined;
    if (doc === undefined || source === undefined) return;
    try {
      const edit = wrapNodes(source, selection, wrapper);
      // The wrapper, selected: it starts where the edit's selection does.
      const wrapped = callLocations(parseSource(edit.source).root!).find(({ node }) => node.from === edit.selection.from)?.node;
      apply(doc, edit, wrapped ? [{ documentId: doc, from: wrapped.from, to: wrapped.to }] : []);
    } catch (problem) {
      fail(problem, "Those couldn't be wrapped together.");
    }
  }

  function moveSelection(target: Mark) {
    const doc = selectionDoc;
    const source = doc !== undefined ? sources[doc] : undefined;
    if (doc === undefined || source === undefined) return;
    try {
      apply(doc, moveNodesInto(source, selection, target, contextFor(doc)), []);
    } catch (problem) {
      fail(problem, "Those couldn't be moved there.");
    }
  }

  /** The widgets on the selection's page that take children, for Move to. */
  const moveTargets = useMemo<MoveTarget[]>(() => {
    if (!multi || selectionDoc === undefined) return [];
    const source = sources[selectionDoc];
    const root = source !== undefined ? parseSource(source).root : undefined;
    if (!root) return [];
    const context = contextFor(selectionDoc);
    const inside = (node: { from: number; to: number }) => selection.some((mark) => node.from >= mark.from && node.to <= mark.to);
    const hosts = callLocations(root)
      .map(({ node }) => node)
      .filter((node) => widgetSlots(node, context).some((slot) => slot.list) && !inside(node));
    return hosts.map((node) => ({
      mark: { documentId: selectionDoc, from: node.from, to: node.to },
      label: nodeLabel(node),
      depth: hosts.filter((other) => other !== node && other.from <= node.from && other.to >= node.to).length,
    }));
  }, [multi, selectionDoc, sources, selection, components]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectionBox = useMemo<Box | undefined>(() => {
    const present = boxes.filter((box): box is Box => !!box);
    if (!present.length) return undefined;
    const top = Math.min(...present.map((box) => box.top));
    const left = Math.min(...present.map((box) => box.left));
    const bottom = Math.max(...present.map((box) => box.top + box.height));
    const right = Math.max(...present.map((box) => box.left + box.width));
    return { top, left, width: right - left, height: bottom - top };
  }, [boxes]);

  // --- The tree ---------------------------------------------------------------------
  // The files the page on screen is drawn from, in the order they appear.
  const [onScreen, setOnScreen] = useState<string[]>([]);
  useEffect(() => {
    if (!treeOpen) return;
    const read = () => {
      const seen: string[] = [];
      document.querySelectorAll(`[${ATTRIBUTE}]`).forEach((element) => {
        const mark = parseMark(element.getAttribute(ATTRIBUTE));
        if (mark && !seen.includes(mark.documentId)) seen.push(mark.documentId);
      });
      setOnScreen((current) => (current.join("|") === seen.join("|") ? current : seen));
    };
    read();
    const timer = setInterval(read, 1000);
    return () => clearInterval(timer);
  }, [treeOpen, project]);
  const treeDocuments = useMemo<TreeDocument[]>(
    () =>
      onScreen
        .filter((documentId) => sources[documentId] !== undefined)
        .map((documentId) => ({ documentId, label: `${labelOf(documentId)} · ${fileOf(documentId)?.path ?? ""}`, source: sources[documentId] })),
    [onScreen, sources], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Data lists -------------------------------------------------------------------
  /** The page a data list goes on: the selection's, else the page on screen. */
  const dataPage = (): string | undefined => {
    if (primary && isPage(primary.documentId)) return primary.documentId;
    const seen = new Set<string>();
    document.querySelectorAll(`[${ATTRIBUTE}]`).forEach((element) => {
      const mark = parseMark(element.getAttribute(ATTRIBUTE));
      if (mark) seen.add(mark.documentId);
    });
    return [...seen].find(isPage);
  };

  function addDataList(list: DataList) {
    const doc = dataPage();
    const source = doc !== undefined ? sources[doc] : undefined;
    if (doc === undefined || source === undefined) return setError("Open a page of the site to add a data list to it.");
    try {
      const context = contextFor(doc);
      const root = parseSource(source).root;
      if (!root) throw new Error("This page's code has an error: fix it first.");
      // After the selected widget when it's in a list; else into the page's
      // first list of children.
      const after = primary?.documentId === doc ? callLocations(root).find(({ node }) => node.from === primary.from && node.to === primary.to) : undefined;
      let edit: SourceEdit;
      if (after?.list) edit = insertWidget(source, { from: after.node.from, to: after.node.to }, "after", list.widget, context);
      else {
        const host = callLocations(root).find(({ node }) => widgetSlots(node, context).some((slot) => slot.list));
        if (!host) throw new Error("This page has nothing that takes a list of children: add a Column first.");
        edit = insertWidget(source, { from: host.node.from, to: host.node.to }, "inside", list.widget, context);
      }
      const store = storeFor(edit.source);
      if (!imports(edit.source, list.name)) edit = addDataImport(edit.source, list.entry(store), list.client);
      const added = callLocations(parseSource(edit.source).root!).filter(
        ({ node }) => node.name === "ForEach" && node.args.items?.type === "ref" && node.args.items.name === list.name,
      );
      const node = added.at(-1)?.node;
      apply(doc, edit, node ? [{ documentId: doc, from: node.from, to: node.to }] : []);
      setNotice(
        list.client
          ? `${list.label} are the signed-in customer's: the page shows them once someone is signed in.`
          : store === "site.store" && list.entry(store).includes("site.store")
            ? `${list.label} come from the site's store: set providers.upskale.store in flux.json to choose which.`
            : `${list.label} added, with their data imported.`,
      );
    } catch (problem) {
      fail(problem, "That list couldn't be added.");
    }
  }

  // --- Theme ------------------------------------------------------------------------
  useEffect(() => {
    if (!themeOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setThemeOpen(false);
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [themeOpen]);

  function applyTheme(config: StudioConfig, details: { name: string; description: string }) {
    saveConfig(config, details.name, details.description)
      .then(() => {
        setThemeOpen(false);
        setNotice("Theme saved to flux.json.");
        refresh();
      })
      .catch((problem) => fail(problem, "The theme couldn't be saved."));
  }

  // A build stopped by an error leaves the page on the last one that worked,
  // while the files on disk have moved on: editing waits until it's fixed.
  const failing = project?.failing ?? [];
  const paused = failing.length > 0;

  return (
    <div className="studio-root flux-overlay" data-editing={editing || undefined}>
      {editing && !paused && !themeOpen && hover && !drag && <div className="flux-box is-hover" style={boxStyle(hover)} />}
      {editing &&
        !paused &&
        !themeOpen &&
        boxes.map((box, index) => box && <div key={index} className={"flux-box is-selected" + (multi ? " is-multi" : "")} style={boxStyle(box)} />)}
      {pointedBox && <div className="flux-box is-pointed" style={boxStyle(pointedBox)} />}
      {drag?.target && <div className={`flux-drop is-${drag.target.placement}${drag.target.horizontal ? " is-horizontal" : ""}`} style={dropStyle(drag.target)} />}
      {drag && (
        <div className="flux-drag-label" style={{ left: drag.x + 14, top: drag.y + 14 }}>
          {drag.target ? `${drag.target.placement === "inside" ? "Into" : drag.target.placement === "before" ? "Before" : "After"} this` : `Moving ${drag.label}`}
        </div>
      )}

      {paused && (
        <div className="flux-stale" role="status">
          <strong>
            {failing[0].path}
            {failing[0].line ? `:${failing[0].line}:${failing[0].column}` : ""}
          </strong>{" "}
          {failing[0].message}
          {failing.length > 1 && <span className="flux-stale-more"> and {failing.length - 1} more</span>}
          <span className="flux-stale-note">
            The page shows the last version that worked. Editing here picks up again once this is fixed.
          </span>
        </div>
      )}

      {editing && !paused && multi && !drag && !themeOpen && (
        <MultiBar
          count={selection.length}
          box={selectionBox}
          targets={moveTargets}
          onWrap={wrapSelection}
          onMove={moveSelection}
          onHoverTarget={setPointed}
          onDelete={deleteSelection}
          onClear={() => setSelection([])}
        />
      )}

      {editing && !paused && card && sources[card.documentId] !== undefined && (
        <PropertyCard
          key={`${card.documentId}:${card.from}:${card.name}:${card.adding}`}
          request={card}
          source={sources[card.documentId]}
          file={fileOf(card.documentId)?.path ?? ""}
          box={boxes.at(-1)}
          components={components}
          currentComponent={currentComponent(card.documentId)}
          config={project?.config}
          pagePaths={pagePaths}
          onDone={(edit) => {
            apply(card.documentId, edit);
            setCard(undefined);
          }}
          onCancel={() => setCard(undefined)}
        />
      )}

      {properties && !paused && (
        <StudioContextMenu
          label="Properties"
          searchable
          x={properties.x}
          y={properties.y}
          items={propertyItems(properties.mark)}
          onClose={() => setTimeout(() => setProperties((open) => (open === properties ? undefined : open)))}
        />
      )}

      {menu && !paused && sources[menu.mark.documentId] !== undefined && (
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
          onProperty={(name, adding) => openCard(menu.mark, name, adding)}
        />
      )}

      {treeOpen && (
        <Tree
          documents={treeDocuments}
          componentNames={Object.keys(componentSources)}
          selected={selection}
          onHover={setPointed}
          onSelect={(mark, add) => {
            if (!editing) setEditing(true);
            select(mark, add);
            elementFor(mark)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }}
          onClose={() => {
            setTreeOpen(false);
            setPointed(undefined);
          }}
        />
      )}

      {themeOpen && project && (
        <div
          className="flux-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Theme and settings"
          onPointerDown={(event) => {
            // A press on the backdrop, not the dialog, closes it.
            if (event.target === event.currentTarget) setThemeOpen(false);
          }}
        >
          <div className="flux-modal-panel">
        <ConfigDialog
          config={project.config}
          theme="light"
          readOnly={false}
          details={{ name: project.name, description: project.description ?? "" }}
          facts={[
            { label: "Settings file", value: "flux.json" },
            { label: "Pages", value: String(project.pages.length) },
          ]}
          onApply={applyTheme}
          onClose={() => setThemeOpen(false)}
        />
          </div>
        </div>
      )}

      <Launcher
        editing={editing}
        status={paused ? "Paused: fix the error above" : saving ? "Saving…" : multi ? `${selection.length} selected` : undefined}
        treeOpen={treeOpen}
        canAddData={project ? undefined : "Loading the project…"}
        onToggleEditing={() => {
          setEditing((on) => !on);
          setMenu(undefined);
        }}
        onToggleTree={() => setTreeOpen((on) => !on)}
        onOpenTheme={() => setThemeOpen(true)}
        onAddData={addDataList}
      />

      {notice && !error && (
        <p className="flux-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
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
      const kept = calls.find((node) => node.from === current.from);
      if (kept) return { documentId, from: kept.from, to: kept.to };
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

/** Where a dragged widget would land: a line on the target's edge, or around it for inside. */
function dropStyle(target: NonNullable<Drag["target"]>) {
  const { box, placement, horizontal } = target;
  if (placement === "inside") return boxStyle(box);
  if (horizontal) return { top: box.top, height: box.height, left: (placement === "before" ? box.left : box.left + box.width) - 2, width: 4 };
  return { left: box.left, width: box.width, top: (placement === "before" ? box.top : box.top + box.height) - 2, height: 4 };
}

