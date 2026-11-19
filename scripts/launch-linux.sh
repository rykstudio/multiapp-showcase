#!/usr/bin/env bash
# Launch the local development build through the npm script instead of assuming
# Electron's binary was installed at a particular node_modules path.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$root"

# Desktop environments do not always inherit NVM's interactive-shell PATH.
if ! command -v npm >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available to the desktop launcher. Install Node.js 22, or make it available via NVM." >&2
  exit 1
fi
if [[ ! -f "$root/node_modules/electron/package.json" ]]; then
  echo "Electron npm package is missing. Run 'npm ci' in $root first." >&2
  exit 1
fi

# npm start uses the project's official Electron entry point and can print
# actionable diagnostic errors if the Electron binary download is incomplete.
exec npm start
