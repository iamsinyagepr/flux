// Synced from Upskale Studio (upskaleapp/src/lib/studio/languageService.ts). Edit it there, then npm run sync.
import { FLUTTER_PLACEHOLDERS } from "./flutterSupport";
import { clientImportsOf } from "./clientData";
import { validInputName } from "./formRuntime";
import {
  rootBindingTypes,
  notImportedMessage,
  referenceType,
  expressionType,
  elementType,
  bindingFields,
  type BindingScope,
} from "./dataBindings";
import { componentReferences } from "./projectComponents";
import { CLIENT_RESOURCES, importScope } from "./pageData";
import { readPageFields } from "./pageSource";
import { dataOptionType, pageVariant } from "./pageModel";
import { activeCustomTokens } from "./projectConfig";
import type { ReferenceEntry } from "./registry";
import {
  constructorRegistry,
  functionRegistry,
  tokenFamilies,
} from "./registry";
import {
  childrenOf,
  literalValue,
  parseSource,
  type Expr,
  type CallExpr,
} from "./parser";
export interface StudioDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  from: number;
  to: number;
}
export interface SourceAnalysis {
  source: string;
  root?: CallExpr;
  diagnostics: StudioDiagnostic[];
  variants: CallExpr[];
  options: CallExpr[];
  parts: Map<string, Expr>;
  states: Map<string, Expr>;
  kind: string;
  name: string;
}
export const productFields = Object.keys(bindingFields("PreviewProduct"));
export const storeFields = Object.keys(bindingFields("Store"));
const widgetGroups = [
  "Layout",
  "Content",
  "Behavior",
  "Composition",
  "Storefront",
  "Storefront controls",
  "Components",
  "Forms",
  "Library",
];
function numericLiteral(node: Expr | undefined): number | undefined {
  const value = literalValue(node);
  if (typeof value === "number") return value;
  if (node?.type === "unary" && node.op === "-") {
    const child = numericLiteral(node.child);
    return child === undefined ? undefined : -child;
  }
  return undefined;
}
export function analyzeSource(
  source: string,
  components: ReadonlyMap<string, ReferenceEntry> = new Map(),
  currentComponent?: string,
  /**
   * A page's data by name, with their types (pageData's importScope), for a
   * source that doesn't declare its own: one with data: [...] uses that.
   */
  data: Record<string, string> = {},
): SourceAnalysis {
  const parsed = parseSource(source);
  const result: SourceAnalysis = {
    source,
    ...parsed,
    variants: [],
    options: [],
    parts: new Map(),
    states: new Map(),
    kind: "",
    name: "",
  };
  const root = parsed.root;
  if (!root) return result;
  // A Page: a page file's root (pageModel.ts). Its route, data and SEO are
  // checked as page settings, not as widgets, and its data is in scope; its
  // one build is presented as a variant, so everything that reads variants
  // (the preview, the compilers) reads a page the same way.
  const isPage = root.name === "Page";
  if (isPage) {
    const page = readPageFields(source, root);
    if (page.has.data) data = importScope(page.data);
    for (const problem of page.problems)
      result.diagnostics.push({ code: "page-data", severity: "error", ...problem });
  } else if (root.name === "Component" && root.args.data?.type === "list") {
    // A component's usingClient: the customer's own data, nothing fetched.
    const own = clientImportsOf(root);
    for (const item of root.args.data.items)
      if (item.type !== "call" || item.args.from?.type !== "call" || !item.args.from.name.startsWith("Client."))
        result.diagnostics.push({ code: "page-data", severity: "error", message: "A component imports only the customer's own data (Client.cart(), Client.store(), …): pass anything else in as an option.", from: item.from, to: item.to });
    data = { ...data, ...Object.fromEntries(Object.entries(own).map(([name, resource]) => [name, CLIENT_RESOURCES[resource].type])) };
  }
  function issue(node: Expr, message: string, code = "local-check") {
    if (result.diagnostics.length < 60)
      result.diagnostics.push({
        code,
        severity: "error",
        message,
        from: node.from,
        to: node.to,
      });
  }
  const list = (node: Expr | undefined) =>
    node?.type === "list" ? node.items : [];
  const text = (node: Expr | undefined) => String(literalValue(node) ?? "");
  result.variants = isPage
    ? [pageVariant(root)].filter((node): node is CallExpr => !!node)
    : list(root.args.variants).filter(
        (node): node is CallExpr => node.type === "call" && node.name === "Variant",
      );
  result.options = isPage
    ? []
    : list(root.args.options).filter(
        (node): node is CallExpr =>
          node.type === "call" && node.name.endsWith("Option"),
      );
  result.kind = isPage
    ? "page"
    : root.args.kind?.type === "ref"
      ? root.args.kind.name.split(".")[1]
      : "";
  result.name = text(root.args.name);
  for (const part of list(root.args.parts)) {
    if (part.type === "call" && part.name === "Part" && part.args.build) {
      const name = text(part.args.name);
      if (result.parts.has(name)) issue(part, "Duplicate part: " + name);
      result.parts.set(name, part.args.build);
    }
  }
  for (const state of list(root.args.states)) {
    if (
      state.type === "call" &&
      ["BoolState", "StringState", "NumberState"].includes(state.name) &&
      state.args.default
    ) {
      const name = text(state.args.name);
      if (!validInputName(name))
        issue(state, "State names must be valid identifiers.");
      if (result.states.has(name)) issue(state, "Duplicate state: " + name);
      const defaultValue =
        state.name === "NumberState"
          ? numericLiteral(state.args.default)
          : literalValue(state.args.default);
      if (
        typeof defaultValue !==
        (
          {
            BoolState: "boolean",
            StringState: "string",
            NumberState: "number",
          } as Record<string, string>
        )[state.name]
      )
        issue(
          state,
          "State defaults must match their declared primitive type.",
        );
      result.states.set(name, state.args.default);
    }
  }
  const formIds = new Set<string>();
  function checkForms(
    node: Expr,
    active?: { names: Set<string>; node: CallExpr },
    select = false,
  ) {
    if (node.type !== "call") {
      childrenOf(node).forEach((child) => checkForms(child, active, select));
      return;
    }
    if (node.name === "Variant") formIds.clear();
    if (node.name === "Form") {
      const id = text(node.args.id);
      if (!validInputName(id))
        issue(node, "Form IDs must be valid identifiers.");
      if (formIds.has(id)) issue(node, "Duplicate form ID: " + id);
      formIds.add(id);
      if (active) issue(node, "Forms cannot be nested.");
      active = { names: new Set(), node };
    }
    const fields = ["TextField", "SearchField", "Checkbox", "SelectField"];
    if (fields.includes(node.name)) {
      const name = text(node.args.name) || text(node.args.state),
        bound = text(node.args.state);
      if (
        (active || node.args.name || node.args.state) &&
        !validInputName(name)
      )
        issue(node, "Fields need a valid name or state binding.");
      if (active && active.names.has(name))
        issue(node, "Duplicate form field: " + name);
      active?.names.add(name);
      if (!node.args.label && !node.args.ariaLabel)
        issue(node, "Fields need label or ariaLabel.");
      if (node.args.state && !result.states.has(bound))
        issue(node, "Unknown state binding: " + bound);
      const defaultValue = result.states.get(bound);
      if (bound && defaultValue) {
        const expected =
          node.name === "Checkbox"
            ? "boolean"
            : node.args.type?.type === "ref" &&
                node.args.type.name === "InputType.number"
              ? "number"
              : "string";
        const value =
          expected === "number"
            ? numericLiteral(defaultValue)
            : literalValue(defaultValue);
        if (typeof value !== expected)
          issue(node, "Input type does not match the bound state.");
      }
      for (const key of ["minLength", "maxLength", "rows"]) {
        const value = numericLiteral(node.args[key]);
        if (
          value !== undefined &&
          (!Number.isInteger(value) ||
            value < (key === "minLength" ? 0 : 1) ||
            value > (key === "rows" ? 12 : 8000))
        )
          issue(node, key + " is outside the supported range.");
      }
      for (const [low, high] of [
        ["minLength", "maxLength"],
        ["min", "max"],
      ]) {
        const a = numericLiteral(node.args[low]),
          b = numericLiteral(node.args[high]);
        if (a !== undefined && b !== undefined && a > b)
          issue(node, low + " must not exceed " + high + ".");
      }
    }
    if (["SubmitButton", "ResetButton"].includes(node.name) && !active)
      issue(node, node.name + " must be inside Form.");
    if (node.name === "SelectOption" && !select)
      issue(node, "SelectOption must be inside SelectField.options.");
    if (["SetState", "Toggle"].includes(node.name)) {
      const name = text(node.args.state);
      if (!result.states.has(name))
        issue(node, "Unknown state binding: " + name);
      else if (
        node.name === "Toggle" &&
        typeof literalValue(result.states.get(name)) !== "boolean"
      )
        issue(node, "Toggle needs a BoolState.");
      else if (node.name === "SetState") {
        const assigned = literalValue(node.args.value),
          initial =
            literalValue(result.states.get(name)) ??
            numericLiteral(result.states.get(name));
        if (
          assigned !== undefined &&
          assigned !== null &&
          typeof assigned !== typeof initial
        )
          issue(node, "SetState value does not match the declared state.");
      }
    }
    if (
      node.name === "Actions" &&
      node.args.actions?.type === "list" &&
      node.args.actions.items.length > 20
    )
      issue(node, "Actions supports up to 20 steps.");
    for (const [key, child] of Object.entries(node.args))
      checkForms(
        child,
        active,
        select || (node.name === "SelectField" && key === "options"),
      );
    node.positional.forEach((child) => checkForms(child, active, select));
  }
  checkForms(root);
  const actionOptions = new Set(
    [
      ...result.options,
      ...result.variants.flatMap((variant) => list(variant.args.options)),
    ].flatMap((option) =>
      option.type === "call" && option.name === "ActionOption"
        ? [text(option.args.name)]
        : [],
    ),
  );
  function isAction(node: Expr): boolean {
    if (node.type === "literal") return node.value === null;
    if (node.type === "ref")
      return (
        node.name.startsWith("options.") &&
        actionOptions.has(node.name.slice(8))
      );
    if (node.type === "conditional")
      return isAction(node.yes) && isAction(node.no);
    return (
      node.type === "call" &&
      constructorRegistry.get(node.name)?.group === "Actions"
    );
  }
  const baseScope: BindingScope = {
    ...rootBindingTypes,
    ...data,
    viewport: ["width", "height"],
    route: ["path", "pattern", "pageId"],
    options: Object.fromEntries(
      result.options.map((option) => [text(option.args.name), dataOptionType(option) ?? "unknown"]),
    ),
    state: [...result.states.keys()],
  };
  function visit(
    node: Expr,
    scope: BindingScope,
    parent?: CallExpr,
    param?: string,
  ) {
    if (node.type === "ref") {
      const [family, field, ...rest] = node.name.split(".");
      if (
        ["__proto__", "prototype", "constructor"].some((name) =>
          node.name.split(".").includes(name),
        )
      )
        issue(node, "This reference is not available.");
      else if (/^[A-Z]/.test(family)) {
        if (
          !(
            tokenFamilies[family]?.includes(field) ||
            activeCustomTokens(family).includes(field)
          ) ||
          rest.length
        )
          issue(node, "Unknown token: " + node.name);
      } else if (!Object.hasOwn(scope, family))
        issue(node, notImportedMessage(family, !isPage) ?? "Unknown data scope: " + family);
      else if (field && !referenceType(node.name, scope))
        issue(node, "Unknown field: " + node.name);
      return;
    }
    if (node.type !== "call") {
      childrenOf(node).forEach((child) => visit(child, scope, parent, param));
      return;
    }
    if (node.name === "Variant") {
      const localOptions =
        node.args.options?.type === "list"
          ? node.args.options.items.filter(
              (item): item is CallExpr => item.type === "call",
            )
          : [];
      scope = {
        ...scope,
        options: {
          ...(scope.options && typeof scope.options === "object" && !Array.isArray(scope.options) ? scope.options : {}),
          ...Object.fromEntries(localOptions.map((option) => [text(option.args.name), dataOptionType(option) ?? "unknown"])),
        },
      };
    }
    const definition =
      (node.name === currentComponent && constructorRegistry.has(node.name)
        ? constructorRegistry.get(node.name)
        : components.get(node.name)) ??
      constructorRegistry.get(node.name) ??
      functionRegistry.get(node.name);
    if (!definition) {
      issue(node, "Unsupported constructor or function: " + node.name);
      childrenOf(node).forEach((child) => visit(child, scope, node));
      return;
    }
    // Fine here, a placeholder in the Flutter app: said where it's used.
    const placeholder = FLUTTER_PLACEHOLDERS.get(node.name);
    if (placeholder && result.diagnostics.length < 60)
      result.diagnostics.push({
        code: "flutter-placeholder",
        severity: "warning",
        message: `${node.name} shows as a placeholder in the Flutter app: ${placeholder}`,
        from: node.from,
        to: node.to,
      });
    const choices =
      node.name === "Component"
        ? result.variants.map((variant) => ({ id: text(variant.args.id) }))
        : definition.variants;
    const variantRule =
      node.name === "Component"
        ? node.args.defaultVariant
        : choices
          ? node.args.variant
          : undefined;
    const variantOwner = node.name;
    function checkVariantRule(rule: Expr) {
      const literal = literalValue(rule);
      if (
        typeof literal === "string" &&
        !choices?.some((variant) => variant.id === literal)
      )
        issue(
          rule,
          "Unknown variant " +
            JSON.stringify(literal) +
            " on " +
            variantOwner +
            ".",
        );
      else if (rule.type === "conditional") {
        checkVariantRule(rule.yes);
        checkVariantRule(rule.no);
      } else if (rule.type === "call" && rule.name === "Responsive")
        Object.values(rule.args).forEach(checkVariantRule);
    }
    if (variantRule) checkVariantRule(variantRule);
    if (functionRegistry.has(node.name)) {
      if (node.positional.length !== definition.required.length)
        issue(
          node,
          node.name +
            " expects " +
            definition.required.length +
            " positional arguments.",
        );
    } else {
      for (const name of definition.required)
        if (!Object.hasOwn(node.args, name))
          issue(node, node.name + " requires " + name + ".");
      for (const [name, value] of Object.entries(node.args)) {
        const expected = definition.parameters[name];
        if (!expected) {
          // A Search's are the page's own search params: any name.
          if (node.name !== "Search") issue(value, "Unknown parameter " + name + " on " + node.name + ".");
          continue;
        }
        const literal = literalValue(value);
        if (expected === "Action" && !isAction(value))
          issue(
            value,
            name + " must be an action or an ActionOption reference.",
          );
        if (expected === "List<Action>" && value.type === "list")
          for (const step of value.items)
            if (!isAction(step))
              issue(
                step,
                "Each step must be an action or an ActionOption reference.",
              );
        if (literal !== undefined && literal !== null) {
          if (expected === "Bool" && typeof literal !== "boolean")
            issue(value, name + " must be a boolean.");
          if (expected === "Number" && typeof literal !== "number")
            issue(value, name + " must be a number.");
          if (expected === "String" && typeof literal !== "string")
            issue(value, name + " must be text.");
        }
        if (
          expected.startsWith("List") &&
          value.type !== "list" &&
          value.type !== "ref" &&
          value.type !== "call"
        )
          issue(value, name + " must be a list.");
        if (
          expected === "Widget" &&
          (value.type === "call"
            ? !widgetGroups.includes(
                (
                  components.get(value.name) ??
                  constructorRegistry.get(value.name)
                )?.group ?? "",
              )
            : value.type !== "conditional")
        )
          issue(value, name + " must build a widget.");
      }
    }
    if (
      node.name === "TriggerButton" &&
      (parent?.name !== "Drawer" || param !== "trigger")
    )
      issue(node, "TriggerButton is only valid as Drawer.trigger.");
    if (node.name === "Drawer" && !node.args.trigger && !node.args.open)
      issue(node, "A Drawer needs a trigger, or open to show it on a condition.");
    if (
      ["Expanded", "Flexible"].includes(node.name) &&
      !["Row", "Column", "Flex"].includes(parent?.name ?? "")
    )
      issue(node, node.name + " must be a direct Row, Column or Flex child.");
    if (
      ["Expanded", "Flexible", "Spacer"].includes(node.name) &&
      node.args.flex
    ) {
      const flex = numericLiteral(node.args.flex);
      if (
        typeof flex === "number" &&
        (!Number.isInteger(flex) || flex <= 0 || flex > 100)
      )
        issue(node.args.flex, "flex must be an integer from 1 to 100.");
    }
    if (node.name === "Positioned") {
      if (parent?.name !== "Stack")
        issue(node, "Positioned must be a direct Stack child.");
      for (const axis of [
        ["left", "right", "width"],
        ["top", "bottom", "height"],
      ])
        if (
          axis.every(
            (key) => node.args[key] && literalValue(node.args[key]) !== null,
          )
        )
          issue(
            node,
            "Positioned accepts at most two of " + axis.join("/") + ".",
          );
    }
    if (node.name === "Layer" && parent?.name !== "Layers")
      issue(node, "Layer must be a direct Layers overlay.");
    if (["Stack", "Positioned", "SizedBox"].includes(node.name))
      for (const key of ["width", "height"]) {
        const dimension = node.args[key],
          value = numericLiteral(dimension);
        if (value !== undefined && value < 0)
          issue(dimension!, key + " must be non-negative.");
      }
    if (node.name === "Use" && !result.parts.has(text(node.args.part)))
      issue(node, "Unknown part: " + text(node.args.part));
    if (node.name === "Toggle" && !result.states.has(text(node.args.state)))
      issue(node, "Unknown state: " + text(node.args.state));
    if (
      node.name === "Grid" &&
      Boolean(node.args.cols) === Boolean(node.args.minItemWidth)
    )
      issue(node, "Grid requires either cols or minItemWidth.");
    if (node.name === "Box" && node.args.onTap && !node.args.ariaLabel)
      issue(node, "A clickable Box requires ariaLabel.");
    if (
      ["Button", "TriggerButton"].includes(node.name) &&
      !node.args.label &&
      !(node.args.icon && node.args.ariaLabel)
    )
      issue(node, "Provide label, or icon and ariaLabel.");
    if (
      node.name === "Image" &&
      literalValue(node.args.alt) === "" &&
      literalValue(node.args.decorative) !== true
    )
      issue(node, "Empty alt text requires decorative: true.");
    if (node.name === "ForEach") {
      const alias = text(node.args.as),
        index = text(node.args.indexAs);
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias) ||
        Object.hasOwn(scope, alias) ||
        ["__proto__", "constructor", "prototype"].includes(alias)
      )
        issue(node, "ForEach alias must be a new valid identifier.");
      if (
        index &&
        (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(index) ||
          Object.hasOwn(scope, index) ||
          index === alias ||
          ["__proto__", "constructor", "prototype"].includes(index))
      )
        issue(node, "indexAs must be a new valid identifier.");
      for (const [key, value] of Object.entries(node.args))
        visit(
          value,
          key === "child"
            ? {
                ...scope,
                [alias]:
                  elementType(expressionType(node.args.items, scope)) ??
                  "PreviewProduct",
                ...(index ? { [index]: [] } : {}),
              }
            : scope,
          node,
          key,
        );
      return;
    }
    if (
      node.name.endsWith("Option") &&
      node.args.default &&
      !(
        (node.args.default.type === "literal" && !node.args.default.segments) ||
        (node.args.default.type === "ref" &&
          /^[A-Z]/.test(node.args.default.name))
      )
    )
      issue(
        node.args.default,
        "Option defaults must be literal values or theme tokens.",
      );
    if (node.name === "MapMarker" && (parent?.name !== "GoogleMap" || param !== "markers"))
      issue(node, "MapMarker is only valid in GoogleMap.markers.");
    if (node.name === "GoogleMap")
      for (const marker of list(node.args.markers))
        if (marker.type !== "call" || marker.name !== "MapMarker") issue(marker, "GoogleMap's markers are MapMarker(...) items.");
    if (node.name === "Lottie" && node.args.src?.type === "literal" && typeof node.args.src.value === "string" && !/^https:\/\//.test(node.args.src.value))
      issue(node.args.src, "A Lottie's src is a web address starting https://.");
    if (node.name === "Embed") {
      const ref = text(node.args.component) || text(node.args.ref);
      if (ref && !["core/product-card", "acme/product-card-pro"].includes(ref))
        issue(node, "Local preview cannot resolve component: " + ref);
      if (!node.args.ref && !node.args.component)
        issue(node, "Embed requires ref or component.");
    }
    if (node.name === "NumberOption") {
      const min = literalValue(node.args.min),
        max = literalValue(node.args.max),
        value = literalValue(node.args.default);
      if (
        typeof min === "number" &&
        typeof max === "number" &&
        (min > max ||
          (typeof value === "number" && (value < min || value > max)))
      )
        issue(node, "NumberOption default must be within min/max.");
    }
    if (node.name === "StringOption") {
      const max = literalValue(node.args.maxLength),
        value = literalValue(node.args.default);
      if (
        typeof max === "number" &&
        (max < 1 ||
          max > 200 ||
          (typeof value === "string" && value.length > max))
      )
        issue(
          node,
          "StringOption maxLength is 1-200 and must fit its default.",
        );
    }
    if (node.name === "EnumOption") {
      const choices = list(node.args.values);
      const key = (expr: Expr | undefined) =>
        expr?.type === "ref" ? expr.name : literalValue(expr);
      if (!choices.some((choice) => key(choice) === key(node.args.default)))
        issue(node, "EnumOption default must be one of its values.");
    }
    for (const [key, value] of Object.entries(node.args)) {
      const nextParent = node;
      if (node === root && !isPage && key === "data") continue;
      if (node === root && !isPage && (key === "route" || key === "seo")) {
        issue(
          value,
          `${key} is a Page's, not a component's: a component gets data through options, DataOption(name: "product", type: Product).`,
        );
        continue;
      }
      // A DataOption's type is a data type (Store, Product…), not a token.
      if (node.name === "DataOption" && key === "type") {
        if (!dataOptionType(node)) issue(value, "type is one of the API's data types: Store, Product, Category, Menu, Order, Address….");
        continue;
      }
      if (node === root && (key === "route" || key === "data")) continue;
      if (node === root && key === "seo") {
        // Only the head's expressions read data; the rest is checked above.
        if (value.type === "call")
          for (const field of ["title", "description", "image"])
            if (value.args[field]) visit(value.args[field], scope, value, field);
        continue;
      }
      if (value.type === "list") {
        value.items.forEach((item) => visit(item, scope, nextParent, key));
      } else visit(value, scope, node, key);
    }
    node.positional.forEach((value) => visit(value, scope, node));
  }
  visit(root, baseScope);
  if (isPage) {
    // A page: a name and what it builds; no dsl, id, kind, variants or options.
    if (!result.name.trim() || result.name.length > 60)
      issue(root.args.name ?? root, "Page name must be 1-60 characters.");
    if (!root.args.build) issue(root, "A Page needs build: what it shows.");
  } else {
    if (literalValue(root.args.dsl) !== 1) issue(root, "Use dsl: 1.");
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(text(root.args.id)))
      issue(root.args.id ?? root, 'Component id must use "publisher/name".');
    if (!result.name.trim() || result.name.length > 60)
      issue(root.args.name ?? root, "Component name must be 1-60 characters.");
    if (text(root.args.description).length > 200)
      issue(
        root.args.description ?? root,
        "Description is limited to 200 characters.",
      );
    if (!result.variants.length || result.variants.length > 8)
      issue(root, "Declare 1-8 variants.");
  }
  const ids = new Set<string>();
  for (const variant of result.variants) {
    const id = text(variant.args.id);
    if (!id || ids.has(id))
      issue(variant, "Variant ids must be non-empty and unique.");
    ids.add(id);
  }
  if (result.options.length > 24) issue(root, "Declare at most 24 options.");
  const named = new Set<string>();
  for (const option of result.options) {
    const name = text(option.args.name);
    if (name === "variant")
      issue(
        option,
        'The option name "variant" is reserved for selecting a component variant.',
      );
    if (!validInputName(name) || named.has(name))
      issue(option, "Option names must be valid and unique.");
    named.add(name);
  }
  const completedParts = new Set<string>();
  function checkPart(name: string, path: Set<string>) {
    if (completedParts.has(name)) return;
    if (path.has(name)) {
      issue(
        result.parts.get(name) ?? root!,
        "Cyclic part reference: " + [...path, name].join(" -> "),
      );
      return;
    }
    const node = result.parts.get(name);
    if (!node) return;
    const next = new Set([...path, name]);
    function walk(expr: Expr) {
      if (expr.type === "call" && expr.name === "Use")
        checkPart(text(expr.args.part), next);
      childrenOf(expr).forEach(walk);
    }
    walk(node);
    completedParts.add(name);
  }
  for (const name of result.parts.keys()) checkPart(name, new Set());
  return result;
}
export const languageServiceStatus = {
  available: true,
  message: "Local syntax and preview checks are connected.",
} as const;
export interface StudioLanguageService {
  analyze(
    source: string,
    version: number,
  ): Promise<{ version: number; diagnostics: StudioDiagnostic[] }>;
}
export const localLanguageService: StudioLanguageService = {
  async analyze(source, version) {
    return { version, diagnostics: analyzeSource(source).diagnostics };
  },
};

export function analyzeComponents(
  sources: Record<string, string> = {},
): Record<string, SourceAnalysis> {
  const registry = componentReferences(sources);
  const analyses = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [
      name,
      analyzeSource(source, registry, name),
    ]),
  );
  for (const [name, analysis] of Object.entries(analyses)) {
    const visited = new Set<string>();
    function check(current: string, path: string[]): boolean {
      if (path.includes(current)) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      const definition = analyses[current];
      let cyclic = false;
      function visit(node: Expr) {
        if (
          node.type === "call" &&
          Object.hasOwn(analyses, node.name) &&
          !(node.name === current && constructorRegistry.has(current))
        ) {
          cyclic ||= check(node.name, [...path, current]);
        }
        childrenOf(node).forEach(visit);
      }
      if (definition?.root) visit(definition.root);
      return cyclic;
    }
    if (check(name, []))
      analysis.diagnostics.push({
        code: "component-cycle",
        severity: "error",
        message: "Cyclic component reference involving " + name + ".",
        from: 0,
        to: Math.min(analysis.source.length, 9),
      });
  }
  return analyses;
}
