package cdsl

import (
	"strings"

	"github.com/iamsinyagepr/flux/js"
)

// Pages and components, as Flux has them now (upskaleapp's pageModel.ts):
//
//	Page(name: "Dish", route: Route(...), data: [...], seo: Seo(...),
//	     states: [...], build: Scaffold(...))
//
// is a page file's root: one build, no variants, options, description, kind
// or dsl. A Component never has a route or data; what it shows of a page's
// data reaches it through a typed option, DataOption(name: "product",
// type: Product), read as options.product.name.
//
// A page's route, data and SEO are still sent beside its source (Studio keeps
// them in step with it), so builds read them from there as before; the
// analysis only has to know a Page and not mistake those fields for widgets.

// pageVariant is a Page's build as the one variant it has: what the
// compilers read a component's variants for, so they read a page the same
// way. It sits exactly where the build is in the source.
func pageVariant(root *Expr) *Expr {
	build := root.Arg("build")
	if build == nil {
		return nil
	}
	args := &Args{}
	args.set("id", &Expr{Kind: Literal, From: build.From, To: build.From, Value: js.StringValue("page")})
	args.set("label", &Expr{Kind: Literal, From: build.From, To: build.From, Value: js.StringValue("Page")})
	args.set("build", build)
	return &Expr{Kind: Call, Name: "Variant", Args: args, From: build.From, To: build.To}
}

// dataOptionType is a DataOption's type as the bindings name it ("Product",
// "Store[]" with list: true), or "" for any other option, or a type that
// isn't one of the API's.
func dataOptionType(option *Expr) string {
	if option == nil || !option.IsCall("DataOption") {
		return ""
	}
	t := option.Arg("type")
	if t == nil || t.Kind != Ref || strings.Contains(t.Name, ".") || t.Name == "" || t.Name[0] < 'A' || t.Name[0] > 'Z' {
		return ""
	}
	if len(BindingFields(t.Name)) == 0 {
		return ""
	}
	if js.StrictEquals(LiteralValue(option.Arg("list")), js.BoolValue(true)) {
		return t.Name + "[]"
	}
	return t.Name
}
