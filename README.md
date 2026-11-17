# Flux

A small, readable language for building interfaces. Write a page once in
`.flx`, then compile it to a React website or a Flutter app.

```
Page(name: "Dish", route: Route(path: "/dishes/$dish"))

usingServer(
  dish<Product>(src: Tenant.product(id: route.dish)),
)

State(
  quantity: Number(default: 1),
)

Build(
  Column(gap: Space.md, children: [
    Text(child: dish.name, size: FontSize.xl),
    Text(child: formatMoney(dish.display_price_cents), weight: FontWeight.bold),
  ])
)
```

```sh
npm create @upskale/flux@latest my-app
cd my-app
npx flux dev
```

> Flux is being extracted from [Upskale Studio](https://upskalelabs.dev),
> where it was called CDSL. Nothing here is released yet. See
> [PLAN.md](PLAN.md) for what is being built and in what order.

Docs: <https://flux.upskalelabs.dev> (coming).

## License

[MIT](LICENSE)
