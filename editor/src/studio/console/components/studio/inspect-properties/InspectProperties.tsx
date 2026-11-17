// Synced from Upskale Studio (upskaleapp/src/console/components/studio/inspect-properties/InspectProperties.tsx). Edit it there, then npm run sync.
import { useMemo, useState } from "react";
import { MdAdd, MdArrowDownward, MdArrowUpward, MdClose, MdCode, MdVerticalAlignTop } from "react-icons/md";
import type { CallExpr } from "../../../../lib/studio/parser";
import type { StudioDiagnostic } from "../../../../lib/studio/languageService";
import type { ReferenceEntry } from "../../../../lib/studio/registry";
import type { StudioConfig } from "../../../../lib/studio/projectConfig";
import { type SourceEdit, definitionOf, setArgument, removeArgument, callLocations, isWidget, widgetSlots, moveListItem } from "../../../../lib/studio/sourceEdits";
import { propertyRows, propertyDefault, nodeLabel } from "../../../../lib/studio/visualModel";
import { PropertyField, fieldContextFor } from "../../../../components/studio/VisualFields";
import StudioContextMenu from "../../../../components/studio/StudioContextMenu";
import { valueMenu } from "../../../functions/studio/value-menu/index";

/**
 * The inspected widget's properties as a form, in the sidebar: picked in the
 * preview with Inspect on, each field writes its Flux as it changes (one undo
 * step per change), and Add property sets one more to its default.
 */
export function InspectProperties({
  node,
  root,
  source,
  documentLabel,
  components,
  currentComponent,
  config,
  diagnostics,
  pagePaths,
  readOnly,
  onEdit,
  onError,
  onShowCode,
  onClose,
  onSelect,
  onAddChild,
}: {
  node: CallExpr;
  root: CallExpr | undefined;
  source: string;
  /** The page or component it is in. */
  documentLabel: string;
  components: ReadonlyMap<string, ReferenceEntry>;
  currentComponent?: string;
  config?: StudioConfig;
  diagnostics: StudioDiagnostic[];
  pagePaths: string[];
  readOnly: boolean;
  onEdit(edit: SourceEdit): void;
  onError(message: string): void;
  onShowCode(): void;
  onClose(): void;
  /** Focus another widget of this document: its parent, or one of its children. */
  onSelect(range: { from: number; to: number }): void;
  /** Add a widget inside it: the add menu, at this point. */
  onAddChild(x: number, y: number): void;
}) {
  const context = { components, currentComponent };
  const entry = definitionOf(node, context);
  const { rows, available } = propertyRows(source, node, entry);
  const range = { from: node.from, to: node.to };
  const fieldContext = useMemo(
    () => fieldContextFor({ source, root, at: node.from, config, pagePaths, readOnly }),
    [source, root, node.from, config, pagePaths, readOnly],
  );
  const run = (make: () => SourceEdit) => {
    try {
      onEdit(make());
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "That change couldn't be made.");
    }
  };
  // Where it sits: the widget it's in, when it's in one.
  const location = useMemo(
    () => (root ? callLocations(root).find((item) => item.node.from === node.from && item.node.to === node.to) : undefined),
    [root, node.from, node.to],
  );
  const parent = location?.parent && isWidget(location.parent, context) ? location.parent : undefined;
  // What it holds: each widget slot, a list's children in order.
  const slots = widgetSlots(node, context).filter((slot) => node.args[slot.name]);
  // The header's +: the properties it can still have, each with its choices.
  const [adding, setAdding] = useState<{ x: number; y: number }>();
  const setRow = (name: string, text: string) => run(() => setArgument(source, range, name, text));
  const errorFor = (name: string) => {
    const value = node.args[name];
    return value
      ? diagnostics.find((issue) => issue.severity === "error" && issue.from >= value.from && issue.to <= value.to)?.message
      : undefined;
  };
  return (
    <section className="studio-inspect-properties" aria-label={"Properties of " + node.name}>
      <header className="studio-inspect-properties-head">
        <div>
          <h2>{node.name}</h2>
          <small>{documentLabel}</small>
        </div>
        {parent && (
          <button
            type="button"
            className="studio-icon-button"
            aria-label={"Parent: " + parent.name}
            title={"Parent: " + nodeLabel(parent)}
            onClick={() => onSelect({ from: parent.from, to: parent.to })}
          >
            <MdVerticalAlignTop aria-hidden="true" />
          </button>
        )}
        {entry && !readOnly && (
          <button
            type="button"
            className="studio-icon-button"
            aria-label="Add property"
            title={available.length ? "Add property" : "Every property is set"}
            disabled={!available.length}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setAdding({ x: box.left, y: box.bottom + 4 });
            }}
          >
            <MdAdd aria-hidden="true" />
          </button>
        )}
        <button type="button" className="studio-icon-button" aria-label="Show its code" title="Show its code in the Flux editor" onClick={onShowCode}>
          <MdCode aria-hidden="true" />
        </button>
        <button type="button" className="studio-icon-button" aria-label="Back to the files" title="Back to the files" onClick={onClose}>
          <MdClose aria-hidden="true" />
        </button>
      </header>
      <div className="studio-inspect-properties-body">
        {!entry && <p className="studio-inspect-properties-note">{node.name} isn't a widget Studio knows, so its properties can only be changed in its code.</p>}
        {rows.length === 0 && entry && <p className="studio-inspect-properties-note">Nothing set yet: add a property below.</p>}
        {rows.map((row) => {
          const visual = (row.spec.kind === "color" || row.spec.kind === "token") && row.value.mode !== "expression";
          return (
            <PropertyField
              key={row.name + ":" + node.from}
              layout={visual ? "card" : "form"}
              row={row}
              expr={node.args[row.name]}
              context={fieldContext}
              error={errorFor(row.name)}
              onSet={(text) => setRow(row.name, text)}
              onRemove={() => run(() => removeArgument(source, range, row.name))}
            />
          );
        })}
        {slots.map((slot) => {
          const value = node.args[slot.name];
          const children = value.type === "list" ? value.items : [value];
          const movable = slot.list && value.type === "list" && !readOnly;
          return (
            <div key={slot.name} className="studio-inspect-children" role="group" aria-label={slot.name}>
              <div className="studio-visual-field-label">
                <span>{slot.name}</span>
                <small>{slot.list ? children.length + (children.length === 1 ? " child" : " children") : "child"}</small>
              </div>
              <ol>
                {children.map((child, index) => {
                  const label = child.type === "call" ? nodeLabel(child) : source.slice(child.from, child.to).slice(0, 40);
                  // Up or down one place; the form stays on this widget.
                  const move = (to: number) =>
                    child.type === "call" &&
                    run(() => ({
                      ...moveListItem(source, { from: child.from, to: child.to }, to),
                      selection: { from: node.from, to: node.from + node.name.length },
                    }));
                  return (
                    <li key={child.from} className="studio-inspect-child">
                      {child.type === "call" ? (
                        <button type="button" title={"Select " + label} onClick={() => onSelect({ from: child.from, to: child.to })}>
                          {label}
                        </button>
                      ) : (
                        <code>{label}</code>
                      )}
                      {movable && child.type === "call" && (
                        <>
                          <button
                            type="button"
                            className="studio-icon-button studio-inspect-child-move"
                            aria-label={"Move " + label + " up"}
                            title="Move up"
                            disabled={index === 0}
                            onClick={() => move(index - 1)}
                          >
                            <MdArrowUpward aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="studio-icon-button studio-inspect-child-move"
                            aria-label={"Move " + label + " down"}
                            title="Move down"
                            disabled={index === children.length - 1}
                            onClick={() => move(index + 1)}
                          >
                            <MdArrowDownward aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {slot.list && !readOnly && (
                <button
                  type="button"
                  className="studio-inspect-add-child"
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    onAddChild(box.left, box.bottom + 4);
                  }}
                >
                  <MdAdd aria-hidden="true" />
                  Add child
                </button>
              )}
            </div>
          );
        })}
        {/* Room for children, none yet: a layout's first. */}
        {!readOnly && widgetSlots(node, context).some((slot) => slot.list && !node.args[slot.name]) && (
          <button
            type="button"
            className="studio-inspect-add-child is-first"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              onAddChild(box.left, box.bottom + 4);
            }}
          >
            <MdAdd aria-hidden="true" />
            Add child
          </button>
        )}
      </div>
      {adding && (
        <StudioContextMenu
          label="Add property"
          searchable
          x={adding.x}
          y={adding.y}
          onClose={() => setAdding(undefined)}
          items={available.map((item, index) => {
            const add = () => run(() => setArgument(source, range, item.name, propertyDefault(item.name, item.type, config)));
            // Its values to pick from (colours as swatches, Align.center…);
            // anything needing its own form starts at its default, there below.
            const choices = valueMenu(item, {
              config,
              write: (text) => run(() => setArgument(source, range, item.name, text)),
              open: add,
              onError,
            });
            return {
              section: index === 0 ? "Properties" : undefined,
              label: item.name,
              hint: item.type,
              children: choices?.children,
              onSelect: choices?.children ? undefined : add,
            };
          })}
        />
      )}
    </section>
  );
}
