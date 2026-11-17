package web

import (
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/pagedata"
)

// A page importing only the customer's own (Client.cart()): nothing is
// fetched for it; its route follows it as it changes, and the page reads it
// live.
func TestClientImportsAreReadLive(t *testing.T) {
	source := "Page(name: \"Cart\", route: Route(path: \"/cart\"))\n\nusingClient(\n  cart<Cart>(src: Client.cart()),\n)\n\nBuild(\n  Text(child: \"${cart.count} items\")\n)\n"
	r := Compile(Input{Name: "Shop", Pages: []dart.Page{{ID: "cart", Name: "Cart", Path: "/cart", Source: source,
		Data: []pagedata.Import{{Name: "cart", Source: "client", Resource: "cart", Fetch: "client"}}}}, EntryPageID: "cart"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	f := files(r)
	route := f["src/routes/page-cart.tsx"]
	for _, want := range []string{`import { useMemo } from "react";`, `rt.useClient("cart")`} {
		if !strings.Contains(route, want) {
			t.Errorf("route lacks %s:\n%s", want, route)
		}
	}
	if strings.Contains(route, "useQuery") || f["src/queries/cart.ts"] != "" {
		t.Error("a client import is fetched")
	}
	if !strings.Contains(f["src/pages/cart.tsx"], `rt.client(b, "cart")`) {
		t.Errorf("the page doesn't read the cart live:\n%s", f["src/pages/cart.tsx"])
	}
}
