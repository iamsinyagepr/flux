#!/usr/bin/env bash
# Publishes a release's eight npm packages, in the order they depend on each
# other: the six platform binaries, then @upskale/flux (which lists them),
# then @upskale/create-flux (which uses it).
#
#   bash scripts/publish.sh 0.1.2            # publishes release-0.1.2/npm
#   bash scripts/publish.sh 0.1.2 release    # or another folder: release/npm
#
# Run it in your own terminal: each publish asks you to approve it in the
# browser (two-factor authentication), which needs an interactive terminal.
# A dropped upload is tried again; a package already published is skipped,
# so running it again after a failure carries on where it stopped.
set -u

version="${1:?usage: bash scripts/publish.sh <version> [release folder]}"
folder="${2:-release-$version}"
cd "$(dirname "$0")/.." || exit 1
npm_dir="$folder/npm"

packages=(
  flux-win32-x64
  flux-win32-arm64
  flux-darwin-x64
  flux-darwin-arm64
  flux-linux-x64
  flux-linux-arm64
  flux
  create-flux
)

if [ ! -d "$npm_dir" ]; then
  echo "No $npm_dir: build it first with  RELEASE_DIR=$folder node scripts/release.mjs $version" >&2
  exit 1
fi
if ! user=$(npm whoami 2>/dev/null); then
  echo "Not logged in to npm: run  npm login  first." >&2
  exit 1
fi
echo "Publishing $version from $npm_dir as $user"

for package in "${packages[@]}"; do
  dir="$npm_dir/$package"
  name="@upskale/$package"
  built=$(node -p "require('./$dir/package.json').version")
  if [ "$built" != "$version" ]; then
    echo "$dir is version $built, not $version: rebuild the release." >&2
    exit 1
  fi
  if [ "$(npm view "$name@$version" version 2>/dev/null)" = "$version" ]; then
    echo "✓ $name@$version is already published"
    continue
  fi
  published=
  for attempt in 1 2 3 4 5; do
    echo "→ $name@$version (try $attempt)"
    if (cd "$dir" && npm publish --access public --auth-type=web); then
      published=1
      break
    fi
    # It may have gone through even though the connection dropped after.
    if [ "$(npm view "$name@$version" version --prefer-online 2>/dev/null)" = "$version" ]; then
      published=1
      break
    fi
    echo "  that didn't go through; trying again in 10 seconds…"
    sleep 10
  done
  if [ -z "$published" ]; then
    echo "✗ $name@$version didn't publish after 5 tries. Run the script again to carry on from here." >&2
    exit 1
  fi
  echo "✓ $name@$version"
done

echo
echo "All eight are published at $version. Check with:  npm view @upskale/flux version"
