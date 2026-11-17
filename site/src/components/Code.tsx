import { useState, type ReactNode } from "react";

/**
 * Flux highlighted as the VS Code grammar does it (editors/vscode/syntaxes):
 * blocks, widgets, parameters, typed data, tokens, strings with ${…}.
 */
const BLOCKS = new Set(["Page", "Component", "usingServer", "usingClient", "Options", "State", "Parts", "Build", "Variants"]);

const LEXER =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(\b[a-z][A-Za-z0-9_]*)(<)([A-Z][A-Za-z0-9_<>]*(?:\[\])?)(>)|(\b[A-Za-z_][A-Za-z0-9_]*)(\s*:)(?!\/)|(\b[A-Z][A-Za-z0-9_]*\.[a-z][A-Za-z0-9_]*)(?=\s*\()|(\b[A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|(\b[A-Z][A-Za-z0-9_]*\.[a-z][A-Za-z0-9_]*\b)|(\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b)/g;

function string(text: string, key: number): ReactNode {
  // ${…} inside a string: the expression highlighted, the rest a string.
  const parts: ReactNode[] = [];
  let at = 0;
  let i = 0;
  for (const match of text.matchAll(/\$\{([^}]*)\}/g)) {
    if (match.index! > at) parts.push(<span key={i++} className="t-string">{text.slice(at, match.index)}</span>);
    parts.push(<span key={i++} className="t-token">{"${"}</span>, ...flux(match[1], i++), <span key={i++} className="t-token">{"}"}</span>);
    at = match.index! + match[0].length;
  }
  if (at < text.length) parts.push(<span key={i++} className="t-string">{text.slice(at)}</span>);
  return <span key={key}>{parts}</span>;
}

function flux(source: string, base = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let k = base * 1000;
  for (const m of source.matchAll(LEXER)) {
    if (m.index! > at) out.push(source.slice(at, m.index));
    if (m[1]) out.push(<span key={k++} className="t-comment">{m[1]}</span>);
    else if (m[2]) out.push(string(m[2], k++));
    else if (m[3])
      out.push(
        <span key={k++} className="t-param">{m[3]}</span>,
        m[4],
        <span key={k++} className="t-type">{m[5]}</span>,
        m[6],
      );
    else if (m[7]) out.push(<span key={k++} className="t-param">{m[7]}</span>, m[8]);
    else if (m[9]) out.push(<span key={k++} className="t-widget">{m[9]}</span>);
    else if (m[10]) out.push(<span key={k++} className={BLOCKS.has(m[10]) ? "t-block" : "t-widget"}>{m[10]}</span>);
    else if (m[11]) out.push(<span key={k++} className="t-token">{m[11]}</span>);
    else if (m[12] || m[13]) out.push(<span key={k++} className="t-number">{m[0]}</span>);
    at = m.index! + m[0].length;
  }
  if (at < source.length) out.push(source.slice(at));
  return out;
}

/** A shell session: $ prompts dimmed, comments greyed. */
function shell(source: string): ReactNode[] {
  return source.split("\n").flatMap((line, i, all) => {
    const nl = i < all.length - 1 ? "\n" : "";
    if (line.startsWith("$ ")) return [<span key={i + "p"} className="t-prompt">$ </span>, line.slice(2) + nl];
    if (line.trimStart().startsWith("#")) return [<span key={i} className="t-comment">{line}</span>, nl];
    return [line + nl];
  });
}

export function Code({ children, lang = "flux", title }: { children: string; lang?: "flux" | "sh" | "json" | "text"; title?: string }) {
  const source = children.replace(/^\n/, "").replace(/\n\s*$/, "");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    // Commands copy without their prompts.
    const text = lang === "sh" ? source.split("\n").filter((l) => !l.trimStart().startsWith("#")).map((l) => l.replace(/^\$ /, "")).join("\n") : source;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no clipboard: nothing to say */
    }
  };
  const body = lang === "flux" ? flux(source) : lang === "sh" ? shell(source) : source;
  const button = (
    <button type="button" className="copy" onClick={copy} aria-label="Copy code">
      {copied ? "Copied" : "Copy"}
    </button>
  );
  return (
    <div className="code">
      {title && (
        <div className="code-title">
          <span>{title}</span>
          {button}
        </div>
      )}
      {!title && button}
      <pre>
        <code>{body}</code>
      </pre>
    </div>
  );
}
