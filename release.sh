#!/usr/bin/env bash
# Cut a new Jotat release: bump the version everywhere, commit, tag and push.
# Pushing the tag triggers .github/workflows/deploy.yml (deploy + GitHub Release).
#
#   ./release.sh 1.0.1          # bug fix
#   ./release.sh 1.1.0          # new feature
#   ./release.sh 2.0.0          # breaking change
set -euo pipefail

NEW="${1:-}"
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: ./release.sh MAJOR.MINOR.PATCH   (current: $(cat VERSION))"
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$NEW" >/dev/null; then
  echo "Tag v$NEW already exists."
  exit 1
fi
if ! grep -q "^## \[$NEW\]" CHANGELOG.md; then
  echo "Add a '## [$NEW] — $(date +%F)' section to CHANGELOG.md first."
  exit 1
fi

echo "$NEW" > VERSION
sed -i -E "s/(JOTAT_VERSION = \")[^\"]*(\")/\1$NEW\2/" js/version.js
sed -i -E "s/(data-version>v)[0-9]+\.[0-9]+\.[0-9]+/\1$NEW/" index.html auth.html app.html
sed -i -E "s/(Current version: \*\*)[^*]*(\*\*)/\1$NEW\2/" README.md

git add -A
git commit -m "Release $NEW"
git tag -a "v$NEW" -m "Jotat $NEW"
git push origin main
git push origin "v$NEW"
echo "Pushed v$NEW — watch it deploy under the repository's Actions tab."
