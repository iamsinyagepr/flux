// The page's tree: each page and component on screen and the widgets it's
// built from (Studio's sourceTree), in a panel that floats beside the page.
// Hovering a widget outlines it on the page; clicking selects it there.
import { useMemo, useState } from "react";
import { MdChevronRight, MdClose, MdExpandMore } from "react-icons/md";
import { sourceTree, type SourceTreeNode } from "../studio/lib/studio/sourceTree";
import type { Mark } from "./marks";

export interface TreeDocument {
  documentId: string;
  label: string;
  source: string;
}

/**
 * The widgets on the page, as they nest. Studio's outline headings (Outline,
 * a component's variant) are the code view's: their widgets stand in their
 * place; a file's States, Options, Parts and Components lists aren't on the
 * page at all.
 */
function widgets(nodes: SourceTreeNode[]): SourceTreeNode[] {
  return nodes.flatMap((node) => {
    if (node.kind === "section") return ["States", "Options", "Parts", "Components"].includes(node.label) ? [] : widgets(node.children);
    if (node.kind !== "widget") return [];
    // The file's own root (Page, Component) holds the rest.
    if (node.label === "Page" || node.label.startsWith("Component")) return widgets(node.children);
    return [{ ...node, children: widgets(node.children) }];
  });
}

export function Tree({
  documents,
  componentNames,
  selected,
  onHover,
  onSelect,
  onClose,
}: {
  documents: TreeDocument[];
  componentNames: string[];
  selected: Mark[];
  onHover(mark: Mark | undefined): void;
  onSelect(mark: Mark, add: boolean): void;
  onClose(): void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const trees = useMemo(
    () => documents.map((document) => ({ document, nodes: widgets(sourceTree(document.source, document.documentId, componentNames)) })),
    [documents, componentNames],
  );
  const isSelected = (node: SourceTreeNode) =>
    selected.some((mark) => mark.documentId === node.documentId && mark.from === node.from && mark.to === node.to);
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const row = (node: SourceTreeNode, depth: number) => {
    const open = !closed.has(node.id);
    const mark = { documentId: node.documentId, from: node.from, to: node.to };
    return (
      <li key={node.id} role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={isSelected(node)}>
        <div className={"flux-tree-row" + (isSelected(node) ? " is-selected" : "")} style={{ paddingLeft: 6 + depth * 14 }}>
          {node.children.length ? (
            <button type="button" className="flux-tree-toggle" aria-label={open ? "Collapse" : "Expand"} onClick={() => toggle(node.id)}>
              {open ? <MdExpandMore aria-hidden="true" /> : <MdChevronRight aria-hidden="true" />}
            </button>
          ) : (
            <span className="flux-tree-toggle" aria-hidden="true" />
          )}
          <button
            type="button"
            className="flux-tree-label"
            title={node.label}
            onMouseEnter={() => onHover(mark)}
            onMouseLeave={() => onHover(undefined)}
            onFocus={() => onHover(mark)}
            onBlur={() => onHover(undefined)}
            onClick={(event) => onSelect(mark, event.shiftKey || event.ctrlKey || event.metaKey)}
          >
            {node.label}
          </button>
        </div>
        {open && node.children.length > 0 && <ul role="group">{node.children.map((child) => row(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <aside className="flux-tree" aria-label="Page tree">
      <header className="flux-tree-head">
        <strong>Page tree</strong>
        <button type="button" className="flux-tree-close" aria-label="Close the page tree" onClick={onClose}>
          <MdClose aria-hidden="true" />
        </button>
      </header>
      <div className="flux-tree-body">
        {trees.length === 0 && <p className="flux-tree-note">Nothing on this page comes from a .flx file.</p>}
        {trees.map(({ document, nodes }) => (
          <section key={document.documentId} className="flux-tree-document">
            <h3>{document.label}</h3>
            {nodes.length ? <ul role="tree">{nodes.map((node) => row(node, 0))}</ul> : <p className="flux-tree-note">No widgets.</p>}
          </section>
        ))}
      </div>
    </aside>
  );
}
