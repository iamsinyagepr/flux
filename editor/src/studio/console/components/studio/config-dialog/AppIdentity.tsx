// flux dev's stand-in for Studio's AppIdentity (upskaleapp/src/console/
// components/studio/config-dialog/AppIdentity.tsx): a business's own app,
// its icon and store listing, which Studio keeps on Upskale's servers. A
// Flux project has none, and the theme dialog only shows it for one.
export function AppIdentity(_: { business: unknown }) {
  return null;
}
