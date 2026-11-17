package cdsl

// What a page or component imports from the client (Client.cart(), …): the
// customer's own data, read live by the runtimes, never fetched. A port of
// upskaleapp's pageData.ts CLIENT_RESOURCES and clientData.ts.

import "strings"

// ClientResources are the client's imports, by name, with their types.
var ClientResources = map[string]string{
	"cart":     "Cart",
	"store":    "Store",
	"stores":   "StoreSearch",
	"location": "ClientLocation",
	"checkout": "ClientCheckout",
	"session":  "Session",
	"choices":  "ProductChoices",
	"review":   "OrderReview",
}

// ClientImports are a file's client imports by name (its usingClient's
// Data(name: "cart", from: Client.cart())): cart → "cart".
func ClientImports(root *Expr) map[string]string {
	out := map[string]string{}
	if root == nil {
		return out
	}
	for _, item := range ListItems(root.Arg("data")) {
		from := item.Arg("from")
		if !item.IsCall("Data") || from == nil || from.Kind != Call || !strings.HasPrefix(from.Name, "Client.") {
			continue
		}
		resource := from.Name[len("Client."):]
		if name := Text(item.Arg("name")); name != "" && ClientResources[resource] != "" {
			out[name] = resource
		}
	}
	return out
}
