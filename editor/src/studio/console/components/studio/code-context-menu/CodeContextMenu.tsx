// Synced from Upskale Studio (upskaleapp/src/console/components/studio/code-context-menu/CodeContextMenu.tsx). Edit it there, then npm run sync.
import { useState, useRef, useMemo } from "react";
import { MdAdd, MdCallSplit, MdSwapHoriz, MdContentCut, MdContentCopy, MdContentPaste, MdSelectAll, MdApps, MdDeleteOutline, MdControlPointDuplicate, MdTune } from "react-icons/md";
import { insertWired } from "../../../../lib/studio/autoWire";
import { announceDeclaration } from "../../../../lib/studio/canvasPins";
import { codeMenuTarget } from "../../../../lib/studio/codeMenu";
import type { ComponentTemplate } from "../../../../lib/studio/componentTemplates";
import { parseSource } from "../../../../lib/studio/parser";
import type { ReferenceEntry } from "../../../../lib/studio/registry";
import { type SourceEdit, scaffoldBlocker, definitionOf, WRAPPER_GROUPS, wrapperProblem, wrapNode, replacementsFor, replaceWidget, addDeclaration, setArgument, removeArgument, deleteNode, duplicateNode } from "../../../../lib/studio/sourceEdits";
import type { StudioConfig } from "../../../../lib/studio/projectConfig";
import { type PropertyRow, displayName, propertyRows, fieldFor, readValue, freeName, declaredNames, declarationSnippet, widgetCatalog, STATE_TYPES, OPTION_TYPES } from "../../../../lib/studio/visualModel";
import { CODE_MENU_BASICS } from "../../../constants/studio/component-picker/index";
import ComponentPicker from "../../../../components/studio/ComponentPicker";
import AddPropertyCard from "../../../../components/studio/AddPropertyCard";
import { fieldContextFor } from "../../../functions/studio/visual-fields/index";
import StudioContextMenu, { type MenuItem } from "../../../../components/studio/StudioContextMenu";
import type { CodeMenuRequest, PickerRequest } from "../../../../components/studio/CodeContextMenu";
import { pickImageFile, valueMenu, type ValueCardKind } from "../../../functions/studio/value-menu/index";
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { BorderCard, GradientCard, IconPickerCard, ImageDataCard } from "../value-cards/ValueCards";

/**
 * The code editor's context menu: what the Visual editor offers at the same
 * place. Add widgets around the widget the cursor is in (through the widget
 * picker), wrap or replace a widget whose name is clicked or selected, add a
 * state, option or part inside those lists, and the clipboard. Shift+right-click
 * keeps the browser's own menu.
 */
export function CodeContextMenu({
  request,
  source,
  documentId,
  components,
  currentComponent,
  componentSources,
  pageSources,
  templates,
  onImportTemplate,
  readOnly,
  config,
  onEdit,
  onError,
  onClose,
  only,
}: {
  request: CodeMenuRequest;
  source: string;
  documentId: string;
  components: ReadonlyMap<string, ReferenceEntry>;
  currentComponent?: string;
  componentSources?: Record<string, string>;
  pageSources?: Record<string, string>;
  templates: ComponentTemplate[];
  onImportTemplate: (template: ComponentTemplate) => string;
  readOnly: boolean;
  config?: StudioConfig;
  onEdit: (edit: SourceEdit) => void;
  onError: (message: string) => void;
  onClose: () => void;
  /** "add": only what can go inside the widget (the form's Add child). */
  only?: "add";
}) {
  const [picker, setPickerState] = useState<PickerRequest>();
  // "Add property": its value is chosen on a card first (AddPropertyCard).
  const [adding, setAddingState] = useState<{ title: string; row: PropertyRow; range: { from: number; to: number } }>();
  const setAdding = (next: NonNullable<typeof adding>) => {
    opening.current = true;
    setAddingState(next);
  };
  // A value chosen on its own card (an icon, a border, a gradient, image
  // data): set on a property, or (an icon) a new Icon put where it goes.
  const [card, setCardState] = useState<
    { kind: Exclude<ValueCardKind, "custom">; title: string; write(text: string): void } | undefined
  >();
  const setCard = (next: NonNullable<typeof card>) => {
    opening.current = true;
    setCardState(next);
  };
  // Choosing "Add…" closes the menu but opens the picker: don't close both.
  const opening = useRef(false);
  const setPicker = (next: PickerRequest) => {
    opening.current = true;
    setPickerState(next);
  };
  const context = { components, currentComponent };
  const catalog = useMemo(() => widgetCatalog(components), [components]);
  const root = useMemo(() => parseSource(source).root, [source]);
  const target = useMemo(
    () => codeMenuTarget(source, request.offset, { from: request.from, to: request.to }, context),
    [source, request, components, currentComponent],
  );
  const scaffoldReason = useMemo(
    () =>
      scaffoldBlocker(source, currentComponent ?? documentId, { ...pageSources, ...componentSources }, Object.keys(componentSources ?? {})),
    [source, currentComponent, documentId, pageSources, componentSources],
  );
  const run = (make: () => SourceEdit) => {
    if (readOnly) return;
    try {
      onEdit(make());
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "That change could not be made.");
    }
  };

  const items: MenuItem[] = [];
  // What goes inside the widget: all "only: add" shows.
  const insideItems: MenuItem[] = [];
  const widget = target.widget;
  if (widget) {
    const { call } = widget;
    const range = { from: call.from, to: call.to };
    const name = displayName(call.name);
    // Each place a widget can go: the basics, inserted at once, then "From
    // Library…" for everything else. `parent` is who the new widget sits in,
    // for the same placement rules Wrap with uses (Positioned in a Stack).
    const add = (label: string, request: PickerRequest, parent: string | undefined) =>
      items.push({
        section: items.length ? undefined : "Add widget",
        label,
        icon: <MdAdd />,
        disabled: readOnly,
        children: [
          ...CODE_MENU_BASICS.flatMap((basic, index): MenuItem[] => {
            const choice = catalog.find((item) => item.name === basic);
            if (!choice) return [];
            const problem = basic === "Positioned" || basic === "Expanded" ? wrapperProblem(basic, parent) : undefined;
            // An image is a file or data, chosen first.
            const image = (src: string) => run(() => insertWired(source, request, `Image(src: ${src}, alt: "")`, undefined, context));
            if (basic === "Image" && !problem)
              return [
                {
                  section: index === 0 ? "Basic" : undefined,
                  label: basic,
                  title: choice.description,
                  children: [
                    {
                      label: "From a file…",
                      hint: "upload",
                      onSelect: () =>
                        void pickImageFile()
                          .then((url) => url && image(cdslString(url)))
                          .catch((failure) => onError(failure instanceof Error ? failure.message : "That image could not be uploaded.")),
                    },
                    {
                      label: "From data…",
                      hint: "product.image_url…",
                      onSelect: () => setCard({ kind: "imageData", title: "Image from data", write: image }),
                    },
                  ],
                },
              ];
            return [
              {
                section: index === 0 ? "Basic" : undefined,
                label: basic,
                hint: problem ? "unavailable" : undefined,
                title: problem ? problem + "." : choice.description,
                disabled: !!problem,
                // An icon is chosen, not guessed: the picker, then the Icon.
                onSelect: () =>
                  basic === "Icon"
                    ? setCard({
                        kind: "icon",
                        title: "Choose an icon",
                        write: (token) => run(() => insertWired(source, request, `Icon(name: ${token})`, undefined, context)),
                      })
                    : run(() => insertWired(source, request, choice.snippet, undefined, context)),
              },
            ];
          }),
          { section: "More", label: "From Library…", icon: <MdApps />, hint: "all widgets", onSelect: () => setPicker(request) },
        ],
      });
    const lists = widget.slots.filter((slot) => slot.list);
    for (const slot of lists)
      add(lists.length > 1 ? `Add to ${name} ${slot.name}` : `Add to ${name}`, { title: `Add to ${name}`, range, placement: "inside", slot: slot.name }, call.name);
    for (const slot of widget.slots.filter((item) => !item.list && !item.filled))
      add(`Set ${name} ${slot.name}`, { title: `${name} · ${slot.name}`, range, placement: "inside", slot: slot.name }, call.name);
    insideItems.push(...items);
    if (widget.listed) {
      add(`Insert before ${name}`, { title: `Before ${name}`, range, placement: "before" }, widget.parent);
      add(`Insert after ${name}`, { title: `After ${name}`, range, placement: "after" }, widget.parent);
    }
    // Its properties not set yet, the event handlers (onTap…) apart.
    const unset = propertyRows(source, call, definitionOf(call, context)).available;
    if (unset.length) {
      const entry = (item: { name: string; type: string; required: boolean }): MenuItem => {
        // Its value is picked or typed on a card, not guessed (a default would
        // still have to be found and changed).
        const custom = () => {
          const spec = fieldFor(item.type);
          setAdding({
            title: `Add ${item.name} to ${name}`,
            row: { name: item.name, type: item.type, spec, required: item.required, value: readValue(source, undefined, spec) },
            range,
          });
        };
        const write = (text: string) => run(() => setArgument(source, range, item.name, text));
        // A value from a list (Space.md, Align.center, Color.primary…), or Custom…;
        // a border, gradient, icon or image on a card of its own.
        const choices = valueMenu(item, {
          config,
          write,
          open: (kind) => (kind === "custom" ? custom() : setCard({ kind, title: `Add ${item.name} to ${name}`, write })),
          onError,
        });
        return {
          label: item.name,
          hint: item.required ? "required" : item.type,
          ...(choices ?? { onSelect: custom }),
        };
      };
      const handlers = unset.filter((item) => fieldFor(item.type).kind === "action");
      const values = unset.filter((item) => fieldFor(item.type).kind !== "action");
      items.push({
        section: items.length ? undefined : "Add",
        label: "Add property",
        menuLabel: "Add property to " + name,
        icon: <span className="studio-kind-dot is-property" />,
        hint: unset.length + " available",
        disabled: readOnly,
        children: [
          ...values.map((item, index) => ({ ...entry(item), section: index === 0 && handlers.length ? "Properties" : undefined })),
          ...handlers.map((item, index) => ({ ...entry(item), section: index === 0 ? "Handlers" : undefined })),
        ],
      });
    }
    // Its properties already set: changed from a list or on its card (the
    // value as written to start from), or removed.
    const set = propertyRows(source, call, definitionOf(call, context)).rows.filter((row) => Object.hasOwn(call.args, row.name));
    if (set.length) {
      const entry = (row: PropertyRow): MenuItem => {
        const written = source.slice(call.args[row.name].from, call.args[row.name].to);
        const title = `Change ${row.name} on ${name}`;
        const custom = () => setAdding({ title, row, range });
        const write = (text: string) => run(() => setArgument(source, range, row.name, text));
        const choices = valueMenu(row, {
          config,
          write,
          open: (kind) => (kind === "custom" ? custom() : setCard({ kind, title, write })),
          onError,
        });
        const remove: MenuItem = {
          section: "",
          label: "Remove " + row.name,
          icon: <MdDeleteOutline />,
          danger: true,
          disabled: readOnly || row.required,
          title: row.required ? `${name} needs ${row.name}.` : undefined,
          onSelect: () => run(() => removeArgument(source, range, row.name)),
        };
        return {
          label: row.name,
          hint: written.length > 22 ? written.slice(0, 21) + "…" : written,
          title: written,
          children: [...(choices?.children ?? [{ label: "Change…", onSelect: choices?.onSelect ?? custom }]), remove],
        };
      };
      items.push({
        section: items.length ? undefined : "Properties",
        label: "Properties",
        menuLabel: "Properties of " + name,
        icon: <MdTune />,
        hint: set.length + " set",
        disabled: readOnly,
        children: set.map(entry),
      });
    }
    if (widget.onName) {
      items.push({
        section: name,
        label: "Wrap with",
        icon: <MdCallSplit />,
        disabled: readOnly,
        children: WRAPPER_GROUPS.map((group) => ({
          label: group.label,
          children: group.wrappers.map((wrapper) => {
            const problem = wrapper === "Scaffold" ? (scaffoldReason ?? undefined) : wrapperProblem(wrapper, widget.parent);
            return {
              label: wrapper,
              hint: problem ? "unavailable" : undefined,
              title: problem ? problem + "." : undefined,
              disabled: !!problem,
              onSelect: () => run(() => wrapNode(source, range, wrapper)),
            };
          }),
        })),
      });
      const swaps = replacementsFor(call.name);
      if (swaps.length)
        items.push({
          label: "Replace with",
          icon: <MdSwapHoriz />,
          disabled: readOnly,
          children: swaps.map((other) => ({ label: other, hint: "keeps what it can", onSelect: () => run(() => replaceWidget(source, range, other)) })),
        });
      items.push(
        { label: "Duplicate", icon: <MdControlPointDuplicate />, disabled: readOnly || !widget.listed, title: widget.listed ? undefined : "Only something in a list of children can be duplicated.", onSelect: () => run(() => duplicateNode(source, range)) },
        { label: "Delete", icon: <MdDeleteOutline />, danger: true, disabled: readOnly, onSelect: () => run(() => deleteNode(source, range, context)) },
      );
    }
  }
  if (target.list && root) {
    const list = target.list;
    const declare = (type: string) => {
      const base = list === "states" ? "value" : list === "parts" ? "part" : type === "ActionOption" ? "onTap" : "option";
      const name = freeName(base, declaredNames(root, list));
      run(() => addDeclaration(source, list, declarationSnippet(type, name)));
      announceDeclaration(documentId, list, name);
    };
    const kind = list === "states" ? "state" : list === "options" ? "option" : "part";
    if (list === "parts")
      items.push({ section: "Declare", label: "Add part", icon: <span className="studio-kind-dot is-part" />, disabled: readOnly, onSelect: () => declare("Part") });
    else
      items.push({
        section: "Declare",
        label: list === "states" ? "Add state" : "Add option",
        menuLabel: list === "states" ? "Add state" : "Add option",
        icon: <span className={"studio-kind-dot is-" + kind} />,
        disabled: readOnly,
        children: (list === "states" ? STATE_TYPES : OPTION_TYPES).map((type) => ({
          label: type,
          icon: <span className={"studio-kind-dot is-" + kind} />,
          onSelect: () => declare(type),
        })),
      });
  }
  const selected = request.to > request.from;
  items.push(
    { section: "Edit", iconOnly: true, label: "Cut", icon: <MdContentCut />, hint: "Ctrl+X", disabled: readOnly || !selected, onSelect: request.actions.cut },
    { iconOnly: true, label: "Copy", icon: <MdContentCopy />, hint: "Ctrl+C", disabled: !selected, onSelect: request.actions.copy },
    { iconOnly: true, label: "Paste", icon: <MdContentPaste />, hint: "Ctrl+V", disabled: readOnly, onSelect: request.actions.paste },
    { iconOnly: true, label: "Select all", icon: <MdSelectAll />, hint: "Ctrl+A", onSelect: request.actions.selectAll },
  );

  if (card) {
    const done = (text: string) => {
      card.write(text);
      onClose();
    };
    if (card.kind === "icon") return <IconPickerCard x={request.x} y={request.y} title={card.title} config={config} onPick={done} onClose={onClose} />;
    if (card.kind === "border") return <BorderCard x={request.x} y={request.y} title={card.title} config={config} onSet={done} onClose={onClose} />;
    if (card.kind === "gradient") return <GradientCard x={request.x} y={request.y} title={card.title} config={config} onSet={done} onClose={onClose} />;
    return (
      <ImageDataCard
        x={request.x}
        y={request.y}
        title={card.title}
        bindings={fieldContextFor({ source, root, at: request.offset, config, readOnly }).bindings}
        onSet={done}
        onClose={onClose}
      />
    );
  }
  if (adding)
    return (
      <AddPropertyCard
        x={request.x}
        y={request.y}
        title={adding.title}
        row={adding.row}
        context={fieldContextFor({ source, root, at: adding.range.from, config, readOnly })}
        onSet={(text) => {
          run(() => setArgument(source, adding.range, adding.row.name, text));
          onClose();
        }}
        onClose={onClose}
      />
    );
  if (picker)
    return (
      <ComponentPicker
        request={picker}
        exclude={scaffoldReason ? ["Scaffold"] : []}
        snippets={declaredNames(root, "parts")}
        components={components}
        templates={templates}
        onClose={onClose}
        onPick={(item) => {
          onClose();
          run(() => {
            const snippet = item.template ? onImportTemplate(item.template) + "()" : item.snippet;
            const componentSource = item.template?.source ?? (components.has(item.name) ? componentSources?.[item.name] : undefined);
            return insertWired(source, picker, snippet, componentSource, context);
          });
        }}
      />
    );
  return (
    <StudioContextMenu
      label={only ? "Add child" : "Code actions"}
      x={request.x}
      y={request.y}
      items={
        only
          ? // One place to add: its widgets straight away.
            insideItems.length === 1
            ? (insideItems[0].children ?? [])
            : insideItems.length
              ? insideItems
              : [{ label: "Nothing can go inside this", disabled: true }]
          : items
      }
      // The menu closes before it runs the item: wait a tick to see whether
      // the item opened the picker.
      onClose={() =>
        setTimeout(() => {
          if (!opening.current) onClose();
        })
      }
    />
  );
}

export default CodeContextMenu;
