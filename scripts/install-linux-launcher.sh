#!/usr/bin/env bash
# Install a user-scoped GNOME/KDE launcher for the development version.
# No sudo or system-wide changes are required.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
electron="$root/node_modules/electron/dist/electron"
icon="$root/src/assets/zt-app-icon.png"
desktop_id="com.rykstudio.multiappshowcase"
applications="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_file="$applications/$desktop_id.desktop"

if [[ ! -x "$electron" ]]; then
  echo "Electron is not installed. Run npm ci from $root first." >&2
  exit 1
fi
if [[ ! -f "$icon" ]]; then
  echo "Missing branded icon: $icon" >&2
  exit 1
fi
if [[ "$root" == *$'\n'* || "$root" == *'"'* ]]; then
  echo "The project directory cannot contain a quote or newline." >&2
  exit 1
fi

mkdir -p "$applications"
cat > "$desktop_file" <<ENTRY
[Desktop Entry]
Version=1.0
Type=Application
Name=MultiApp Showcase
GenericName=Multi-Application Browser
Comment=Showcase websites in isolated desktop sessions
Exec="$electron" "$root"
TryExec=$electron
Icon=$icon
Terminal=false
StartupNotify=true
StartupWMClass=$desktop_id
Categories=Office;Network;Utility;
ENTRY
chmod 644 "$desktop_file"
if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$desktop_file"
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications" >/dev/null 2>&1 || true
fi
printf 'MultiApp Showcase launcher installed: %s\n' "$desktop_file"
printf 'Launch from the app grid, or run: gtk-launch %s\n' "$desktop_id"
printf 'Remove old Electron/gear pins and pin this launcher to the Dock.\n'
