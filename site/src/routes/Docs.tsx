import type { ReactNode } from "react";
import { Code } from "../components/Code";
import { GITHUB } from "../pages";

function Intro() {
  return (
    <>
      <h1>Flux</h1>
      <p className="intro">
        Flux is a small language for interfaces. You write pages and components in <code>.flx</code> files, and the{" "}
        <code>flux</code> CLI checks them and compiles them to a React website, a Flutter app, or both.
      </p>
      <Code title="pages/home.flx">{`
Page(name: "Home", route: Route(path: "/"), seo: Seo(title: "Hello"))

State(
  count: Number(default: 0),
)

Build(
  Column(gap: Space.md, padding: Insets(x: 24, y: 48), children: [
    Text(child: "Hello from Flux", size: FontSize.display, weight: FontWeight.bold),
    Button(label: "Clicked \${state.count} times", onTap: SetState(state: "count", value: state.count + 1)),
  ])
)`}</Code>
      <h2>What it is for</h2>
      <ul>
        <li>
          <strong>Websites</strong> rendered on the server, each page with its own head (title, description, image, structured
          data) and a sitemap.
        </li>
        <li>
          <strong>Apps</strong> in Flutter, for Android, iOS and the desktop, from the same pages.
        </li>
        <li>
          <strong>Storefronts</strong> on an Upskale business's API, through the <a href="/docs/providers">Upskale provider</a>.
        </li>
      </ul>
      <h2>What it isn't</h2>
      <p>
        Flux isn't a general-purpose language. A page declares what it shows, the data it reads and what a tap does. There are no
        loops to write, no classes and no imports: <code>ForEach</code>, <code>If</code> and the built-in actions cover a screen,
        and anything beyond that belongs in the API the page reads.
      </p>
      <h2>A project</h2>
      <Code lang="text">{`
my-app/
  flux.json              the project's settings
  pages/home.flx         a page: its file name is its id
  pages/about.flx
  components/Header.flx  a component of the project's own
  shell.flx              what every page is drawn inside (optional)`}</Code>
      <p>
        Next: <a href="/docs/getting-started">install the CLI and start one</a>.
      </p>
    </>
  );
}

function GettingStarted() {
  return (
    <>
      <h1>Getting started</h1>
      <p className="intro">You need Node.js 18 or later. The CLI is a native binary, and npm picks the one for your machine.</p>
      <h2>Start a project</h2>
      <Code lang="sh">{`$ npm create @upskale/flux@latest my-app`}</Code>
      <p>It asks which template to start from:</p>
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Makes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>site</code>
            </td>
            <td>A website: two pages and a header component.</td>
          </tr>
          <tr>
            <td>
              <code>app</code>
            </td>
            <td>The same pages, set up to build as a Flutter app.</td>
          </tr>
          <tr>
            <td>
              <code>store</code>
            </td>
            <td>A storefront on an Upskale business's API: its stores, and each store's products.</td>
          </tr>
        </tbody>
      </table>
      <h2>Run it</h2>
      <Code lang="sh">{`$ cd my-app
$ npm install
$ npx flux dev`}</Code>
      <p>
        <code>flux dev</code> builds the website into <code>.flux/web</code>, installs its packages the first time, and serves it
        at <code>http://localhost:5173</code>. Save a <code>.flx</code> file and only the files it changed are rewritten, so the
        page updates in place. With an error in a file, the page keeps its last good build and the error is printed with its
        line and column.
      </p>
      <h2>Edit it on the page</h2>
      <p>
        <code>flux dev</code> puts an editor over the site it serves. Its one control is the round button with the Upskale mark
        at the bottom left. Its menu turns editing on and off (<kbd>E</kbd>), opens the page tree (<kbd>T</kbd>), opens the
        theme and settings, and adds data lists.
      </p>
      <ul>
        <li>hovering a widget outlines it, and clicking selects it;</li>
        <li>
          <kbd>Shift</kbd> + click (or <kbd>Ctrl</kbd> + click) selects several in the same file, and a bar above them can{" "}
          <strong>Wrap in</strong> a Column, Row, Wrap, Stack or Grid, <strong>Move to</strong> another widget (each one outlined
          on the page as you hover it in the list), or <strong>Delete</strong> them. <kbd>Delete</kbd> deletes what's selected
          too;
        </li>
        <li>
          drag a selected widget to move it: a line shows whether it lands before or after the widget under the pointer, and a
          dashed outline that it goes inside one that takes children;
        </li>
        <li>
          right-clicking opens the <strong>menu</strong>: insert a widget before or after it, wrap it, replace it, duplicate or
          delete it, or choose a property under <strong>Add property</strong> or <strong>Properties</strong>;
        </li>
        <li>
          <kbd>Ctrl</kbd> + right-click (<kbd>⌘</kbd> on a Mac) lists the properties the widget has, and the ones it can still
          have;
        </li>
        <li>
          choosing a property opens its <strong>card</strong> beside the widget, with the right control for it (sizes, colours,
          text, an action, highlighted code with completion). Change it there, then <strong>Done</strong> saves it (
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>), and <strong>Cancel</strong> or <kbd>Esc</kbd> leaves it as it was;
        </li>
        <li>
          the <strong>page tree</strong> lists the widgets of each page and component on screen: hovering one outlines it on the
          page, and clicking selects it there;
        </li>
        <li>
          <strong>Theme and settings</strong> opens the theme: colours (light and dark), sizes, icons, page transitions, and the
          project's name and description, saved into <code>flux.json</code>;
        </li>
        <li>
          <strong>Add a data list</strong> puts a list of the business's products, categories, orders or stores on the page, after
          the selected widget, with the page's import of that data added for it. A page that reads data it doesn't import (the
          cart, a store, a menu) gets the import as it's saved;
        </li>
        <li>Alt-click selects the widget around the one you clicked, and Esc deselects.</li>
      </ul>
      <p>
        Saved changes are written to the <code>.flx</code> files, and the page updates as soon as it's rebuilt, so your code
        editor shows them too. While a file has an error, the page keeps its last version that built, a banner says where the
        error is, and editing waits until it's fixed. A file that changed on disk after you started an edit is never
        overwritten: the editor reloads it and asks you to make the change again. Images you add go into{" "}
        <code>public/uploads</code>. These are the same editors as Upskale Studio's. <code>flux dev --no-editor</code> serves
        the site without them.
      </p>
      <h2>Check it</h2>
      <Code lang="sh">{`$ npx flux check
pages/home.flx:11:43: error: Unknown token: FontSize.huge
1 error in 3 files`}</Code>
      <p>
        <code>flux check</code> exits with status 1 when there are errors, so it can gate a pull request.
      </p>
      <h2>Build it</h2>
      <Code lang="sh">{`$ npx flux build --target web       # dist/web: a Node server
$ npx flux build --target flutter   # dist/flutter: a Flutter project`}</Code>
      <h2>Without npm</h2>
      <p>
        Download the binary for your platform from the <a href={GITHUB + "/releases"}>releases</a> and put it on your PATH, or with
        Go:
      </p>
      <Code lang="sh">{`$ go install github.com/iamsinyagepr/flux/cmd/flux@latest`}</Code>
    </>
  );
}

function Language() {
  return (
    <>
      <h1>Files and blocks</h1>
      <p className="intro">
        A <code>.flx</code> file is a header, then the blocks it needs, in this order, with no commas between them. A page starts
        with <code>Page(...)</code> and a component with <code>Component(...)</code>.
      </p>
      <Code title="pages/dish.flx">{`
Page(name: "Dish", route: Route(path: "/dishes/$dish"), seo: Seo(title: "\${dish.name}"))

usingServer(
  dish<Product>(src: Tenant.product(id: route.dish)),
)

usingClient(
  cart<Cart>(src: Client.cart()),
)

State(
  quantity: Number(default: 1),
  notes: String(default: ""),
)

Parts(
  price: Text(child: formatMoney(dish.display_price_cents), weight: FontWeight.bold),
)

Build(
  Column(gap: Space.md, children: [
    Text(child: dish.name, size: FontSize.xl),
    Use(part: "price"),
    Text(child: "\${cart.count} in your cart"),
  ])
)`}</Code>
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Holds</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>Page(...)</code>
            </td>
            <td>
              <code>name</code>, <code>route</code> and <code>seo</code>
            </td>
            <td>yes</td>
          </tr>
          <tr>
            <td>
              <code>usingServer(...)</code>
            </td>
            <td>data the website fetches on its server and renders into the page; the head can read it</td>
            <td>no</td>
          </tr>
          <tr>
            <td>
              <code>usingClient(...)</code>
            </td>
            <td>data the browser fetches once the page is showing</td>
            <td>no</td>
          </tr>
          <tr>
            <td>
              <code>State(...)</code>
            </td>
            <td>the page's own state</td>
            <td>no</td>
          </tr>
          <tr>
            <td>
              <code>Parts(...)</code>
            </td>
            <td>
              named pieces of layout, placed with <code>Use(part: "…")</code>
            </td>
            <td>no</td>
          </tr>
          <tr>
            <td>
              <code>Build(...)</code>
            </td>
            <td>the one widget the page draws</td>
            <td>yes</td>
          </tr>
        </tbody>
      </table>
      <h2>State</h2>
      <p>
        Each entry is <code>name: Type(default: …)</code>, with type <code>String</code>, <code>Number</code> or <code>Bool</code>.
        It's read as <code>state.quantity</code> and set with an action:
      </p>
      <Code>{`Button(label: "More", onTap: SetState(state: "quantity", value: state.quantity + 1))`}</Code>
      <h2>Parts</h2>
      <p>
        A part is a piece of layout with a name, for something a page draws in more than one place or wants out of the way of the
        main tree. <code>Use(part: "price")</code> places it.
      </p>
      <h2>Syntax</h2>
      <ul>
        <li>Blocks are separated by whitespace or new lines, never commas. Entries inside a block are separated by commas, and a trailing one is fine.</li>
        <li>
          <code>// line</code> and <code>/* block */</code> comments go anywhere.
        </li>
        <li>
          Every argument is named: <code>Text(child: "Hi")</code>, never <code>Text("Hi")</code>.
        </li>
      </ul>
    </>
  );
}

function Data() {
  return (
    <>
      <h1>Data</h1>
      <p className="intro">
        A page says what it reads, what type it is and where it comes from. Nothing is read without being declared: a name the
        page didn't import is an error that says which import to add.
      </p>
      <Code>{`
usingServer(
  stores<Store[]>(src: Tenant.stores(city: query.city)),
  weather<Json>(src: Http(url: "https://api.example.com/w?city={city}", params: [Param(name: "city", value: query.city)]), select: "data"),
)`}</Code>
      <h2>An entry</h2>
      <p>
        Each entry is <code>name&lt;Type&gt;(src: …)</code>:
      </p>
      <ul>
        <li>
          The name is how the page reads it: <code>stores.length</code>, <code>weather.temp</code>.
        </li>
        <li>
          The type is what it is. For another API it's what the page reads it as: one of the provider's types, or{" "}
          <code>Json</code> for any shape. <code>Type[]</code> is a list of them.
        </li>
        <li>
          <code>select: "results.0"</code> keeps one part of the answer.
        </li>
      </ul>
      <h2>Where a parameter comes from</h2>
      <table>
        <thead>
          <tr>
            <th>Write</th>
            <th>For</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>route.x</code>
            </td>
            <td>
              a <code>$x</code> in the page's path
            </td>
          </tr>
          <tr>
            <td>
              <code>query.x</code>
            </td>
            <td>
              <code>?x=</code> in the address (declared with the route's <code>search</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>dish.store_id</code>
            </td>
            <td>a field of an entry above it</td>
          </tr>
          <tr>
            <td>
              <code>"en"</code>, <code>20</code>
            </td>
            <td>a value</td>
          </tr>
        </tbody>
      </table>
      <h2>Server or client</h2>
      <p>
        <code>usingServer</code> data is fetched by the website's server before the page is sent, so the page arrives with it,
        and its head (<code>seo</code>) can read it. <code>usingClient</code> data is fetched by the browser once the page is
        showing: use it for anything about the signed-in visitor, which only the browser can ask for. A server entry can't read a
        client one, because the server fetches first. The Flutter app fetches both when the page opens.
      </p>
      <h2>Only what the page reads</h2>
      <p>
        On a website, each server entry goes to the browser with only the fields the page reads. A list of stores shown by name
        sends names, and the rest of each record never leaves the server.
      </p>
      <h2>Another API</h2>
      <Code>{`
usingServer(
  stock<Json>(src: Http(url: "https://stock.example.com/{sku}", secret: "STOCK_KEY", params: [Param(name: "sku", value: query.sku)])),
)`}</Code>
      <p>
        <code>Http</code> takes an https address with <code>{"{placeholders}"}</code>, filled from <code>params</code>.{" "}
        <code>secret</code> names one of the website's environment variables. It's sent as a bearer token (or in{" "}
        <code>header</code>) by the website's server only, and never reaches the browser.
      </p>
    </>
  );
}

function Routes() {
  return (
    <>
      <h1>Routes and SEO</h1>
      <Code>{`Page(name: "Stores", route: Route(path: "/stores", search: Search(city: String(default: ""), page: Number(default: 1))))`}</Code>
      <ul>
        <li>
          <code>path</code> is where the page lives. Each <code>$param</code> in it is read as <code>route.param</code>.
        </li>
        <li>
          <code>search</code> declares its search params, <code>?city=</code> in its address. Each is a <code>String</code>,{" "}
          <code>Number</code> or <code>Bool</code> with an optional default. A <code>query.x</code> the route doesn't declare is a
          mistake, and one the address leaves out is its default.
        </li>
        <li>
          <code>Navigate(to: "/stores", search: Search(city: state.city, page: 2))</code> opens it with them.
        </li>
      </ul>
      <p>
        A page's id is its file name: <code>pages/stores.flx</code> is <code>stores</code>. Without a route, a page is at{" "}
        <code>/&lt;id&gt;</code>, and <code>home</code> is at <code>/</code>.
      </p>
      <h2>SEO</h2>
      <Code>{`seo: Seo(title: "\${dish.name} | \${store.name}", description: dish.description, image: dish.image_url, schema: Schema.product(of: dish))`}</Code>
      <ul>
        <li>
          <code>title</code>, <code>description</code> and <code>image</code> are expressions over the page's server data.
        </li>
        <li>
          <code>schema</code> adds schema.org structured data: <code>Schema.product(of:)</code> or{" "}
          <code>Schema.restaurant(of:)</code>.
        </li>
        <li>
          <code>sitemap: false</code> leaves the page out of <code>sitemap.xml</code>. A page with <code>$params</code> is at many
          addresses, so it's never listed.
        </li>
        <li>
          <code>index: false</code> asks search engines not to index it, and leaves it out of the sitemap too.
        </li>
        <li>
          The website has a <code>sitemap.xml</code> once it knows its address: <code>"site": {"{"} "url": "https://…" {"}"}</code>{" "}
          in <code>flux.json</code>. Without one it has only a <code>robots.txt</code>.
        </li>
      </ul>
    </>
  );
}

function Components() {
  return (
    <>
      <h1>Components</h1>
      <p className="intro">
        A component is a piece of interface a project uses on several pages. It lives in <code>components/&lt;Name&gt;.flx</code>{" "}
        and is placed by its name, like any widget: <code>DishCard(product: dish)</code>.
      </p>
      <Code title="components/DishCard.flx">{`
Component(id: "acme/dish-card", name: "DishCard", kind: Kind.section, description: "A dish, passed in.")

Options(
  product<Product>(required: true),
  title: String(label: "Title", maxLength: 40, default: "Today's pick"),
  featured: Bool(label: "Featured", default: false),
  onTap: Action(label: "When tapped"),
)

State(
  expanded: Bool(default: false),
)

Build(
  Column(gap: Space.sm, children: [
    Text(child: options.title, color: Color.textMuted),
    Text(child: options.product.name, weight: FontWeight.bold),
  ])
)`}</Code>
      <p>
        A component has no route and fetches nothing. What it shows of a page's data is passed in through a typed option, read as{" "}
        <code>options.product.name</code>. It may read the visitor's own data in its own <code>usingClient</code>, such as a
        header's cart count.
      </p>
      <h2>Options</h2>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Takes</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["name<Type>() / name<Type[]>()", "data: required, label"],
            ["name: String(...)", "label, maxLength, default"],
            ["name: Number(...)", "label, min, max, step, default"],
            ["name: Bool(...)", "label, default"],
            ["name: Color(...)", "label, default, allowCustom"],
            ["name: Enum(...)", "label, values, default"],
            ["name: Slot(...)", "another component placed in this one: label, kind, default"],
            ["name: Action(...)", "something a placement runs (onTap): label"],
          ].map(([option, takes]) => (
            <tr key={option}>
              <td>
                <code>{option}</code>
              </td>
              <td>{takes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Variants</h2>
      <p>
        One layout is <code>Build(...)</code>. Several are <code>Variants(...)</code>, each with an id and, if it needs them, its
        own options:
      </p>
      <Code>{`
Variants(
  default: Variant(label: "Default", Build(
    Column(children: [Text(child: options.title)])
  )),
  compact: Variant(label: "Compact", options: Options(dense: Bool(default: true)), Build(
    Row(children: [Text(child: options.title)])
  )),
)`}</Code>
      <p>
        A placement picks one with <code>DishCard(variant: "compact")</code>. <code>defaultVariant:</code> in the header says which
        one it gets otherwise.
      </p>
    </>
  );
}

function Expressions() {
  return (
    <>
      <h1>Expressions</h1>
      <table>
        <thead>
          <tr>
            <th>Write</th>
            <th>For</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['"Hello"', "text"],
            ['"${dish.name} · ${store.city}"', "text with values in it"],
            ["12, 0.5, true, null", "numbers, true or false, nothing"],
            ["[a, b, c]", "a list"],
            ["state.count + 1", "arithmetic: + - * / %"],
            ["a == b, a != b, a < b", "comparison"],
            ["a && b, a || b, !a, a ?? b", "logic, and a fallback for null"],
            ["open ? \"Close\" : \"Open\"", "a condition"],
            ["items[0]", "an item of a list"],
            ["Space.md, Color.primary", "a design token"],
          ].map(([write, means]) => (
            <tr key={write}>
              <td>
                <code>{write}</code>
              </td>
              <td>{means}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Lists and conditions</h2>
      <Code>{`
ForEach(items: stores, as: "store", child: Text(child: store.name), empty: Text(child: "No stores yet."))

If(condition: state.open, then: Text(child: "Open"), else: Text(child: "Closed"))`}</Code>
      <h2>Actions</h2>
      <p>
        What a tap does is an action: <code>Navigate(to:)</code>, <code>SetState(state:, value:)</code>, <code>Toggle(state:)</code>,{" "}
        <code>ShowMessage(message:)</code>, <code>ScrollTo(id:)</code>, <code>SubmitForm(form:)</code> and more. Run several with{" "}
        <code>Actions(actions: [...])</code>. The <a href="/docs/reference">reference</a> lists them all.
      </p>
      <h2>Light and dark</h2>
      <Code>{`Button(label: isDarkMode() ? "Light mode" : "Dark mode", onTap: ToggleDarkMode())`}</Code>
    </>
  );
}

function Cli() {
  const rows: [string, ReactNode][] = [
    ["flux new <name> [--template site|app|store]", "Starts a project in a new folder. npm create @upskale/flux runs this."],
    ["flux check", "Parses and checks every .flx file in the project and prints file:line:col: severity: message. Exits 1 on errors."],
    ["flux build [--target web|flutter] [--out dir]", "Compiles the project. The default target is web for a project with pages, flutter for a single main.flx."],
    ["flux dev [--port 5173] [--no-editor]", "Builds the website into .flux/web, installs its packages, serves it with the editor over it (press E on the page), and rebuilds as you save."],
    ["flux migrate [dir]", "Renames .cdsl files to .flx."],
    ["flux migrate <file>.upskale.json", "Lays out a project exported from Upskale Studio as a Flux project."],
    ["flux lsp", "The language server, over stdio, for editors."],
    ["flux version", "The CLI's version, and the compiler's."],
  ];
  return (
    <>
      <h1>The CLI</h1>
      <p className="intro">
        Every command finds its project by walking up from the current folder to the nearest <code>flux.json</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Command</th>
            <th>Does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([command, does]) => (
            <tr key={command}>
              <td>
                <code>{command}</code>
              </td>
              <td>{does}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>flux.json</h2>
      <Code lang="json">{`
{
  "name": "my-shop",
  "description": "Our storefront",
  "entry": "home",
  "theme": { "colors": { "primary": "#0f766e" } },
  "transitions": { "cart": "slideUp" },
  "site": { "url": "https://shop.example.com" },
  "providers": { "upskale": { "api": "https://api.example.com" } }
}`}</Code>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Is</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["name", "the project's name; its folder's by default"],
            ["entry", "the page the app opens on, by id; home, or else the first page"],
            ["theme", "colours, fonts, sizes, the icon library and the page transition"],
            ["transitions", "pages' own transitions, by page id"],
            ["site", "the website's address, head and structured data"],
            ["providers", "data sources beyond Http (see Providers)"],
          ].map(([field, is]) => (
            <tr key={field}>
              <td>
                <code>{field}</code>
              </td>
              <td>{is}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>In CI</h2>
      <Code lang="sh">{`$ npx flux check && npx flux build --target web`}</Code>
    </>
  );
}

function Targets() {
  return (
    <>
      <h1>Targets</h1>
      <h2>web</h2>
      <p>
        <code>flux build --target web</code> writes a <a href="https://tanstack.com/start">TanStack Start</a> project in{" "}
        <code>dist/web</code>: one route per page, server-rendered, with each page's head, a <code>robots.txt</code>, and a{" "}
        <code>sitemap.xml</code> when <code>flux.json</code> gives the site's <code>url</code>. Only the
        widgets and packages the pages use are included.
      </p>
      <Code lang="sh">{`$ cd dist/web
$ npm install
$ npm run build     # one self-contained server bundle
$ npm start         # node server.mjs`}</Code>
      <h2>flutter</h2>
      <p>
        <code>flux build --target flutter</code> writes a Flutter project in <code>dist/flutter</code>: a <code>pubspec.yaml</code>,
        the pages and components as Dart, and the runtime they share.
      </p>
      <Code lang="sh">{`$ cd dist/flutter
$ flutter create .   # adds the platform folders, once
$ flutter run`}</Code>
      <div className="note">
        <p>
          The output is regenerated on every build, so edit the <code>.flx</code> files, not the output. <code>flux build</code>{" "}
          only ever clears a folder it made itself.
        </p>
      </div>
    </>
  );
}

function Providers() {
  return (
    <>
      <h1>Providers</h1>
      <p className="intro">
        Core Flux reads any API through <code>Http(...)</code>. A provider adds named sources with known types, which the checker
        holds pages to.
      </p>
      <h2>Upskale</h2>
      <p>
        The <code>upskale</code> provider reads an <a href="https://upskalelabs.dev">Upskale</a> business's API: its stores, menus,
        products and orders (<code>Tenant.…</code>), and the visitor's own cart, location, checkout and session (
        <code>Client.…</code>). It also brings the storefront components.
      </p>
      <Code lang="json">{`{ "providers": { "upskale": { "api": "https://api.example.com", "store": "green-basket" } } }`}</Code>
      <p>
        Leave <code>api</code> empty and the project runs on sample data. <code>store</code> pins an app to one store; without it,
        the app opens on a store picker.
      </p>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Tenant.store(store:)", "Store"],
            ["Tenant.menu(store:)", "Menu"],
            ["Tenant.stores(q:, city:, cuisine:, limit:)", "Store[]"],
            ["Tenant.product(id:)", "Product"],
            ["Tenant.products(store:, category_id:, limit:)", "Product[]"],
            ["Tenant.categories(store:)", "Category[]"],
            ["Tenant.reviews(store:, limit:)", "OrderReview[]"],
            ["Tenant.me()", "Me (signed in, client only)"],
            ["Tenant.history(limit:)", "Order[] (signed in, client only)"],
            ["Client.cart()", "Cart"],
            ["Client.store()", "Store"],
            ["Client.checkout()", "ClientCheckout"],
            ["Client.session()", "Session"],
          ].map(([source, type]) => (
            <tr key={source}>
              <td>
                <code>{source}</code>
              </td>
              <td>
                <code>{type}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Signed-in sources are the visitor's own, so only the browser or the app can ask for them, and they go in{" "}
        <code>usingClient</code>.
      </p>
      <h2>Writing a provider</h2>
      <p>
        Providers are compiled into the CLI for now. Upskale's is the model for one: its sources, their parameters and the types
        they answer with. If you'd like to add one for your API, <a href={GITHUB + "/issues"}>open an issue</a> describing it.
      </p>
    </>
  );
}

function Editors() {
  return (
    <>
      <h1>Editor support</h1>
      <h2>VS Code</h2>
      <p>
        Install <strong>Flux</strong> (<code>upskale.flux</code>) from the Visual Studio Marketplace, or from Open VSX for VSCodium
        and Cursor. It brings:
      </p>
      <ul>
        <li>highlighting for blocks, widgets, parameters, typed data, tokens and interpolation;</li>
        <li>
          the checker's diagnostics as you type, across the project, the same ones <code>flux check</code> gives;
        </li>
        <li>completion of widgets, actions, functions, a call's parameters (required ones first) and a token family's values;</li>
        <li>hover with a widget's parameters and their types;</li>
        <li>
          snippets (<code>page</code>, <code>component</code>, <code>server</code>, <code>client</code>, <code>state</code>,{" "}
          <code>foreach</code>), and commands to check, build, run the dev server and migrate;
        </li>
        <li>
          validation of <code>flux.json</code>.
        </li>
      </ul>
      <p>
        The extension ships with <code>flux</code> inside. In a project that installed <code>@upskale/flux</code>, it uses that
        copy instead, so the editor and the build always agree. The <code>flux.path</code> setting overrides both.
      </p>
      <h2>Any other editor</h2>
      <p>
        <code>flux lsp</code> is a Language Server Protocol server over stdio. Point your editor's LSP client at it for files
        ending in <code>.flx</code>. In Neovim:
      </p>
      <Code lang="text">{`
vim.filetype.add({ extension = { flx = "flux" } })
vim.lsp.start({ name = "flux", cmd = { "flux", "lsp" }, root_dir = vim.fs.root(0, { "flux.json" }) })`}</Code>
    </>
  );
}

function Migrating() {
  return (
    <>
      <h1>Migrating from CDSL</h1>
      <p className="intro">
        Flux was CDSL, the language Upskale Studio projects were written in. The language is the same; the name and the file
        extension changed.
      </p>
      <h2>.flx files</h2>
      <Code lang="sh">{`$ flux migrate
pages/home.cdsl → pages/home.flx
components/Header.cdsl → components/Header.flx`}</Code>
      <h2>A Studio project</h2>
      <p>
        In Studio, download the project (it saves as <code>&lt;name&gt;.upskale.json</code>), then:
      </p>
      <Code lang="sh">{`$ flux migrate my-shop.upskale.json
$ cd my-shop
$ flux check`}</Code>
      <p>
        Its pages, components and shell become files, and its theme, transitions and store go into <code>flux.json</code>. A
        project converted to Dart in Studio has no Flux sources left, and can't be migrated.
      </p>
    </>
  );
}

function Contributing() {
  return (
    <>
      <h1>Contributing</h1>
      <p className="intro">
        Flux is MIT licensed and developed in the open at <a href={GITHUB}>{GITHUB.replace("https://", "")}</a>.
      </p>
      <h2>The repository</h2>
      <Code lang="text">{`
cmd/flux/         the CLI
cdsl/             lexer, parser and checker
registry/         the widgets, functions and tokens the checker knows
pagedata/         a page's route, data and SEO
dart/, flutter/   the Flutter compiler and its runtime
web/              the website compiler and its React runtime
testdata/golden/  the parity cases
editors/vscode/   the VS Code extension
site/             this site`}</Code>
      <h2>Tests</h2>
      <Code lang="sh">{`$ go test ./...`}</Code>
      <p>
        The golden cases in <code>testdata/golden</code> are the exact output of Upskale Studio's in-browser compiler for 360
        projects. The Go compiler must reproduce every file byte for byte, and every diagnostic exactly. A change to what a
        compiler writes changes both, with the cases regenerated in the same change.
      </p>
      <h2>Sending a change</h2>
      <ul>
        <li>Open an issue first for anything bigger than a fix, so the design can be agreed before the code.</li>
        <li>
          Sign off your commits (<code>git commit -s</code>): the Developer Certificate of Origin, no CLA.
        </li>
        <li>
          Run <code>gofmt</code>, <code>go vet ./...</code> and <code>go test ./...</code> before you push.
        </li>
      </ul>
    </>
  );
}

export const DOC_PAGES: Record<string, () => ReactNode> = {
  "/docs": Intro,
  "/docs/getting-started": GettingStarted,
  "/docs/language": Language,
  "/docs/data": Data,
  "/docs/routes": Routes,
  "/docs/components": Components,
  "/docs/expressions": Expressions,
  "/docs/cli": Cli,
  "/docs/targets": Targets,
  "/docs/providers": Providers,
  "/docs/editors": Editors,
  "/docs/migrating": Migrating,
  "/docs/contributing": Contributing,
};
