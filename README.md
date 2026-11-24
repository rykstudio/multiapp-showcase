# MultiApp Showcase

A cross-platform Electron desktop showcase for multiple web apps, with independent isolated sessions, configurable horizontal or vertical tabs, grouped applications, a settings editor, and optional demo-login drawers.

## Features

- Open multiple configured websites as browser tabs.
- Each app ID maps to an independent persistent Chromium session, including its own cookies, storage and login state.
- **Settings:** Click **⚙ Settings** to add, rename, remove and reorder apps. Changes are saved to the application's user-data directory, not the bundled application files.
- **Demo logins:** Add any number of demo accounts to an app, each with a title, description, username and optional password. The **☰ Logins** button only appears when the active app has demo logins. Open the drawer and copy individual usernames or passwords with one click.
- Existing passwords are not shown or returned to the Settings screen. Leave password blank when editing to preserve an existing password.
- Passwords use Electron `safeStorage` when a secure OS keyring exists. If no secure OS credential backend is available, **packaged builds refuse new demo passwords** rather than storing them as plaintext. Legacy plaintext entries remain readable until remediated. Development-only plaintext fallback requires an explicit environment override.
- All settings are stored in an embedded SQLite file `multiapp-settings.sqlite` in the Electron user-data directory. Native `node:sqlite` requires no additional platform-specific native module.
- **Encrypted JSON export:** Settings > Export encrypted JSON requests a password (minimum 8 characters) and exports apps, logins and their demo passwords as an AES-256-GCM encrypted document with a scrypt-derived key. The export requires the password again to import on another machine.
- The clipboard contains any copied password until you overwrite it. Avoid storing real production credentials in a shared demo environment.

## Local development

Requires Node.js 22.12+ (Electron 45).

```bash
npm ci
node --test tests/*.test.js
npm start
```

### Ubuntu / GNOME launcher and taskbar icon

Electron can display a gear in Ubuntu's Dock if the running window has no matching XDG desktop entry. MultiApp Showcase sets `app.setDesktopName('com.rykstudio.multiappshowcase.desktop')` before Electron is ready, and the Linux packages configure the matching `desktopName` and `StartupWMClass`.

For **local development**, install the user-scoped launcher once (does not require sudo):

```bash
bash scripts/install-linux-launcher.sh
gtk-launch com.rykstudio.multiappshowcase
```

Launch the app from the Ubuntu application menu or using `gtk-launch`, then unpin any stale Electron/gear launcher and pin **MultiApp Showcase**. The desktop entry runs `scripts/launch-linux.sh`, which invokes `npm start` rather than assuming Electron's executable is present at a particular path. The launcher works with Node.js installations configured through NVM, too. Repeat the installation if you move your repository directory. A built .deb or AppImage uses its own launcher metadata.

If the launcher or `npm start` fails after `npm ci`, inspect the real error in your terminal:

```bash
ls -l node_modules/electron/package.json node_modules/.bin/electron
bash scripts/launch-linux.sh
```

If Electron reports a missing downloaded binary, the npm package may have been installed while installation scripts were blocked. Review npm's install-script policy and run the trusted Electron package's installer manually if appropriate: `node node_modules/electron/install.js`. No global `sudo npm install` is required.

## Import settings and download a template

Open **Settings** and choose **Download JSON template** to save `multiapp-showcase-settings-template.json`. The updated template contains a top-level `groups` array (including an empty example group), four sample applications assigned to groups, demo accounts, a mobile example, hidden apps, theme and sidebar settings. Replace the sample URLs and usernames with your own details. Download the template again after upgrading: previously downloaded JSON files do not change automatically.

Click **Import JSON (plain or encrypted)** and select either an editable plain JSON file in this structure or a password-protected encrypted JSON export. If the file is an encrypted export, enter its export password to decrypt it before previewing. The app validates the format, application IDs, URLs, demo-login IDs and field lengths, then shows a **preview**. The imported apps replace the current **draft** settings, not your saved configuration. Review them and click **Save changes** to apply or **Cancel** to discard.

The JSON includes a top-level `groups` array of explicitly named groups (with distinct nonempty names), global `tabLayout` (`horizontal` or `vertical`), `sidebarCollapsed` (`true` or `false`), and `sidebarWidth` (180 to 420 pixels), as well as global `theme` (`auto`, `light`, `dark`) and, for every application, a `group` reference, `hidden`, `displayMode` and optionally `order`. Older imports without `groups` are supported: group names are derived from the apps. `group` is a case-sensitive label without an application-defined length cap. Set `hidden: true` to remove the app from tabs without deleting its saved configuration or browser session. If `order` is used, provide a distinct nonnegative index on every app; otherwise array order applies. Collapsed and expanded editor sections are temporary interface state and are intentionally not exported.

For each demo login, use `id`, `title`, `description`, `username` and optional `password`. Empty imported passwords preserve an existing encrypted password when the app and login IDs match. Real passwords in an import JSON are stored in plaintext until imported, so protect the file and delete it securely if needed. Internally encrypted passwords cannot be imported between machines; configure them through the UI or using an import file with a plaintext password on the destination computer.

## Sign-in links and popup authentication

Websites that use `window.open()` or `target=_blank` for sign-in now open a temporary embedded BrowserView authentication view **inside the originating application's tab** rather than launching your operating system browser. The popup shares the same persistent Electron session partition as that app, preserving its cookies, authentication and `window.opener`/`postMessage` popup communication. When the popup calls `window.close()`, the app view is restored. Use **Close [Page Title]** in the navigation toolbar to dismiss it manually. The control follows the embedded page's live document title, truncating long titles in the button while preserving the full title in its tooltip and accessible label. Switching to another app preserves that app's distinct session and leaves the originating app's temporary popup associated with its tab.

Only HTTP and HTTPS URLs (and the initial `about:blank`) are allowed in embedded popups. Electron requires its pre-created popup `webContents` to be adopted unchanged by the custom popup view; the implementation uses `BrowserView` for that compatibility path while keeping `WebContentsView` for ordinary tabs. Some identity providers explicitly prohibit embedded browser sign-in, and those restrictions cannot be bypassed; the app will not automatically open the external browser in such cases.

## Temporary mobile responsive preview for Desktop tabs

A desktop-configured tab now has a **Mobile preview** button in the navigation toolbar. Click it to view that website in the existing centered phone-style frame; click **Desktop view** to restore full width. The preview is temporary and per tab, and never changes the stored Desktop mode, app ID, cookies or isolated session. Preview changes the viewport width only, keeping the original desktop user agent, which is useful for testing CSS responsive behaviour. Apps configured as Mobile remain in their saved mobile mode and do not show this temporary toggle. Sign-in popups follow the temporary viewport bounds while active.

The demo login drawer now uses compact clipboard icons instead of text buttons. Each icon retains a tooltip and accessible name, and the copied username or password still produces a confirmation message.

## iPhone-style mobile preview

The Mobile display mode and temporary Mobile Preview use a premium iPhone Pro Max-inspired mock device with rounded metallic edges, a Dynamic Island-style cutout, and an understated bottom home indicator. The embedded browser bounds are aligned with the simulated screen, not stretched edge to edge. This is a visual approximation, not a claim of exact iPhone 18 Pro Max physical specifications or native iOS emulation. The shell remains responsive to window size and full-screen mode.

## Desktop and mobile display modes

In **Settings**, each application now has a **Display mode** selector:

- **Desktop (full window)**: the website fills all space beneath the tab/navigation bars, as before.
- **Mobile (phone preview)**: the website is rendered inside a centered, iPhone Pro Max-inspired phone-style shell with a narrow, responsive viewport. The mobile frame stays centered on resizing or full screen and is limited to roughly 440 px external width and 890 px external height, adapting to small windows. A mobile browser user agent is applied to the website.

The choice is saved in the embedded SQLite `applications.display_mode` column and is included in normal and encrypted JSON exports/imports (`displayMode: "desktop" | "mobile"`). Old SQLite configurations are migrated automatically, defaulting to Desktop. Each tab retains its original application ID and isolated session. Authentication popups also use the current display mode's centered view bounds. Switching display mode may reload the website to apply its mobile or desktop user agent.

## Address-bar toolbar

The horizontal tabs occupy the full top strip. The address/navigation row contains aligned SVG buttons for switching horizontal/vertical tabs, toggling full screen, opening Settings, and opening the icon-only **Mobile Preview** action when applicable. All controls have accessible labels and immediate compact hover tips. The Settings glyph uses a symmetric gear, and the Mobile Preview button switches to a desktop-monitor glyph when active, then back to a phone glyph on return.

### Encrypted export accordion

**Export settings (encrypted JSON)** is a collapsed accordion by default under Settings. Expand it only when exporting, choose and confirm a password, and save the encrypted settings file. Closing it clears the passphrase fields. Import supports both this encrypted export and unencrypted JSON; plain JSON containing real demo passwords must be handled securely.

### Immediate tooltips

Icon hover descriptions appear immediately as compact captions **beneath the complete toolbar**, centered near the hovered icon and clamped to the window edge. They no longer replace the address display or cover adjacent tab/window controls. The tooltip's full meaning is always available to keyboard and screen-reader users via the button's accessible label.

## Horizontal and vertical application tabs

MultiApp Showcase supports two layouts, both selectable from the toolbar or Settings. The selected layout is saved in SQLite and included in JSON import/export.

- **Horizontal tabs:** The upper row holds application tabs, the group filter, overflow chevrons and the searchable dropdown, with **Minimize, Maximize and Close** on the right edge. The lower address row holds navigation, Full screen, Settings and the icon-only Mobile Preview toggle.
- **Vertical sidebar:** With no horizontal tab strip, the same Minimize, Maximize and Close buttons move to the right edge of the remaining address toolbar. A left-hand list of application tabs has rounded initial-letter icons, labels and group information. Use the chevron at the sidebar top to collapse to a slim 56-pixel icon rail, or expand back to the saved width (180–420 pixels). Resize by dragging the sidebar edge or using arrow keys when the resize separator has focus. Use the search button to open the existing keyboard-accessible tab picker.
- The sidebar is hidden while Settings is open; embedded web views automatically reposition to avoid covering the sidebar. Saved app IDs, browser sessions, tabs, demo logins, and the mobile phone-preview remain unchanged.

## Workspace appearance, groups, visibility and demo accounts

**Appearance:** In **Settings**, choose **Auto (system)**, **Light**, or **Dark**. The desktop browser chrome follows that setting; Auto follows the operating system. Embedded websites receive the corresponding native Chromium colour-scheme preference but may retain their own theme controls.

**Grouping:** Open **Settings > Groups** to create, rename or delete named groups independently of applications, including empty groups. Then expand an application in **Settings > Applications**, choose one of the saved groups from its **Group** dropdown (or select Ungrouped), and click **Save changes**. Renaming a group updates its applications; deleting a group keeps the applications but makes them ungrouped. When two or more groups are present among visible applications, tab navigation provides a group filter. The separate `groups` list and app assignments persist in SQLite and both plain/encrypted JSON files.

**Hide versus delete:** The **Hide / Show** control is available directly on each application accordion header, even when collapsed. Hidden applications remain in Settings with their IDs, URLs, demo accounts and browser partitions intact. They are excluded from tab navigation and group filtering; unhiding restores access. **Delete** remains a separate action inside the expanded application panel and removes the entry from saved configuration.

**Ordering:** Drag a header's grip to rearrange applications, or use its always-visible up/down arrows. Changes stay in the Settings draft until you click **Save changes**. Explicit JSON `order` values are supported, but the app's displayed sequence is authoritative once edited.

**Demo accounts:** Login configurations sit within the owning application's accordion as compact nested disclosure panels, with readable titles, usernames and password-status badges. Expand individual accounts to edit the description, username or demo password. None of these UI expansion states are stored in JSON.

## Handling many tabs

The tab bar hides the native horizontal scrollbar and uses subtle left and right chevrons only when tabs overflow. The active tab automatically scrolls into view as you switch tabs. Use the **▾** tab switcher to search all applications by name or URL, or press **Ctrl+K** (Windows/Linux) or **Cmd+K** (macOS). Mouse-wheel scrolling over the tab bar also moves through overflowed tabs. The tab strip keeps its position during page loading and preserves existing isolated browser sessions.

## Collapsible settings and demo logins

The Settings page uses native keyboard-accessible disclosure sections. Applications are listed as compact rows with the app name, Desktop/Mobile mode and number of demo logins. Expand only the application you need, or use **Expand all** / **Collapse all**. Each demo login also has an independent collapsible editor displaying its title and username, plus **Expand logins** / **Collapse logins** within the application. The first application opens by default. Newly added apps and logins open automatically for editing. Collapsing does not save, discard or alter fields, browser sessions or SQLite settings. Click **Save changes** to persist any actual edits.

The **☰ Logins** drawer within a running website now uses its own compact collapsible demo account cards, so large numbers of demo accounts do not create an excessively long panel. The first demo account opens initially and collapsed state is remembered while the application is running.

## Demo login editor

Demo accounts support independent groups within each application. Create, rename, or delete groups under **Demo login groups**, assign accounts with their Group selectors, and expand or collapse individual groups or all groups. Existing accounts are automatically placed in **Ungrouped**. Group membership and collapsed state are saved in SQLite and preserved by encrypted export/import. There is no 50-login-per-app restriction, though performance depends on available device resources.


Under each website, use **+ Add demo login** to add any number of demo accounts with separate titles and descriptions. Complete the title and username (and optionally a password), then click **Save changes**. If the OS secure credential store is unavailable, packaged builds refuse new passwords and display a warning. Existing legacy plaintext values may remain until cleared or reencrypted. Do not use demo credentials as production passwords.

### Login drawer, Copy and Paste

The login drawer stays visible on the right while the active website remains visible on the left. This avoids the previously blank website caused by detaching Electron's native web view. The drawer adjusts to the available window width, including when a vertical tab sidebar is open.

The login drawer always shows both **Username** and **Password** rows. If an account has no saved password, it displays **No password saved** with disabled actions; add the password through its account editor in Settings. Each configured username and saved password has **Copy** and **Paste** icons. **Copy** places the credential on the operating system clipboard. **Paste** is different: click the intended editable input in the visible website, then click Paste alongside the corresponding credential. MultiApp Showcase inserts that value directly into the currently focused page element through Electron; it never returns the secret to the chrome renderer or changes the clipboard. Pasting fails safely if there is no selected editable field. Some websites that put login fields inside inaccessible or third-party frames may require using Copy instead.

## Managing applications

Use the **Settings** button in the top-right of the app. Enter the application title and its name, unique stable ID and URL. Then add optional demo logins. Click **Save changes**. The changes persist across launches.

On first launch, Electron creates `multiapp-settings.sqlite` in its user-data directory. Existing installations automatically migrate apps and demo-login values from the previous `apps.json` file into SQLite, preserving app IDs and Chromium sessions. The old JSON file is kept as `apps.json.pre-sqlite-backup` for recovery. New installations seed the database from bundled `config/apps.json`. The settings editor reads and writes SQLite, not the JSON file. No remote database is required.

### Reordering tabs

In **Settings**, drag the ⠿ handle on any application accordion header to reorder, or use **↑** and **↓** controls directly on the collapsed header. Reordering does not require expanding an application. The numbered entries show the intended left-to-right tab sequence. Click **Save changes** and the tab strip updates immediately. The order is persisted in the application's SQLite database and is restored after closing and reopening the desktop application. Reordering does not change an app ID or clear its isolated browser session. Reordering behaviour is covered by automated regression tests in `tests/app-order.test.js`.

App and demo login IDs must be nonempty, unique within their respective scope, and must not contain control characters. Longer Unicode and punctuation IDs are supported. Legacy app IDs keep their existing Chromium partitions; newly introduced extended IDs use deterministic hash-based partition names to avoid filesystem problems. Changing an app ID creates a new browser session, so old authentication may not carry over. Deleting an app does not automatically purge Chromium's session partition.

## Application branding and icons

The original ZT artwork is retained unchanged at `build/zt-multiapp-desktop.svg`. Electron Builder v26 supports the branded SVG as an icon input. For the Ubuntu-only release workflow below, export native Linux PNGs, a Windows ICO, and a macOS ICNS and verify that they are actually present in the packages. Source icon support alone does not prove that a particular installed launcher displays correctly.

**Development mode:** `npm start` bypasses electron-builder's launcher setup. Electron's desktop window therefore explicitly loads the rasterized `src/assets/zt-app-icon.png`, generated from the same SVG. On macOS, development runs set the Dock icon using `app.dock.setIcon`; installed .app bundles embed the platform icon from the vector source. On Linux, the window/taskbar uses the bundled PNG, while installed packages use their launcher icon.

If `npm start` is already running after pulling the changes, fully quit the Electron process and start it again. On Ubuntu, run `bash scripts/install-linux-launcher.sh` and launch with `gtk-launch com.rykstudio.multiappshowcase` so the desktop entry matches the running app. Desktop environments sometimes cache launcher icons: clear any stale Electron/gear pin before pinning the new launcher.


## Build distributables

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

**This is a new application and repository**, `rykstudio/multiapp-showcase`, version `1.0.0`. Builds are local by default; GitHub Actions may run tests on pull requests, but is not required to package or publish the application.

- Windows: `npm run build:win` for x64 NSIS installer and portable EXE
- macOS: `npm run build:mac` for universal DMG and ZIP
- Linux: `npm run build:linux` for x64 AppImage and DEB

Run tests first with `node --test tests/*.test.js`. Distributables are written to `dist/`. Code signing and Apple notarization require your own credentials. No old release-deletion workflow is included.

**Data separation:** The app's identifier changed from `com.rykstudio.multiappdesktop` to `com.rykstudio.multiappshowcase`. It therefore uses a separate Electron userData directory and independent browser sessions. Import encrypted settings from the previous application if you want the same app list; existing cookies and logged-in sessions are not automatically transferred.

### Repository

This is the independent **[rykstudio/multiapp-showcase](https://github.com/rykstudio/multiapp-showcase)** project. It has its own package identity, configuration and saved login sessions, separate from the earlier `multiapp-desktop` application.

Clone and run on Linux, Windows or macOS:

```bash
git clone https://github.com/rykstudio/multiapp-showcase.git
cd multiapp-showcase
npm ci
node --test tests/*.test.js
npm start
```

Select horizontal or vertical tabs using the layout button beside the address bar. Vertical tabs can be collapsed to an icon rail or resized by dragging the sidebar edge; choose a default layout in Settings.

The packages bundle Electron and do not require Node.js installed by end users. Linux may still require compatible system libraries. Windows signing and macOS signing/notarization are not configured.


## v1.0.0 distribution and release from Ubuntu 26.04 LTS

This section is the **full Ubuntu-only release runbook** for repository [rykstudio/multiapp-showcase](https://github.com/rykstudio/multiapp-showcase). It covers local Linux (AppImage and DEB), cross-built Windows x64 (NSIS and portable EXE), and cross-packaged, **unsigned** macOS (separate Intel x64 and Apple Silicon arm64 ZIP archives). **GitHub Actions is not used**. The packages contain Electron and do not require users to install Node.js.

**Release boundary:** Source version `1.0.0` does not mean the release is tested or published. Test the executable and installer on the target OS. In particular, on Ubuntu 26.04 a DEB may install successfully but fail to launch due to sandbox/AppArmor, permissions, or missing desktop resources. Never fix an unverified build by deleting settings, permanently disabling AppArmor or passing `--no-sandbox` in the shipped desktop entry. macOS packages built on Linux are **not** Apple-signed or notarized and may be blocked by Gatekeeper. Windows cross-builds must be tested on Windows.

### v1.0.0 capabilities

- Isolated persistent Chromium session per application, independent cookies and login state; horizontal and vertical tabs, search/overflow, navigation, fullscreen, and in-tab authentication popups.
- Application groups, visibility (hide without deleting), drag and arrow-based reordering, desktop/mobile modes, and responsive mobile preview.
- Demo-login groups with names, assignment, expand/collapse, reordering, copy/paste and optional OS-encrypted passwords; no fixed 50-login cap.
- No application-defined 40-app / 40-group count limit, or old arbitrary title, group-name, login-ID, and description length caps. IDs must remain nonempty, unique within their scopes, and free from control characters. Large configurations still depend on hardware capacity.
- SQLite local configuration, settings import template, plain JSON import, and password-protected encrypted JSON export. Exported files contain credentials in encrypted form and should be protected.

### 1. Prepare the Ubuntu 26.04 build machine

These instructions assume an x86-64 desktop and an account with permission to publish the GitHub Release.

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential python3 \
  zip unzip xz-utils p7zip-full wine64 gh inkscape imagemagick \
  icnsutils desktop-file-utils libfuse2t64
```

Install Node.js 24 with [nvm](https://github.com/nvm-sh/nvm) (or use an already installed compatible version):

```bash
# Only needed if nvm is not already installed:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source "$HOME/.nvm/nvm.sh"
nvm install 24
nvm use 24
node --version
npm --version
wine --version
gh auth login
gh auth status
```

### 2. Prepare clean, tested release source

Use your existing checkout, or clone the repository:

```bash
mkdir -p "$HOME/Projects"
cd "$HOME/Projects"
git clone https://github.com/rykstudio/multiapp-showcase.git
cd multiapp-showcase

git checkout main
git pull --ff-only origin main
git status --short
npm ci
node -p "require('./package.json').version"
node --check src/main.js
node --check src/renderer.js
node --check src/settings-db.js
node --test tests/*.test.js
```

The version must be `1.0.0` and all tests must pass. Stop and correct failures before building. Any uncommitted edits should be reviewed and committed (or discarded) before tagging the release. Preserve the application data stored under Electron's per-user configuration directory; source cleanup must not delete that database.

### 3. Prepare and verify the branded native icons

The master artwork is `build/zt-multiapp-desktop.svg` and the application uses `src/assets/zt-app-icon.png` at runtime. Convert the same artwork for each platform:

```bash
mkdir -p build/icons
for SIZE in 16 24 32 48 64 128 256 512 1024; do
  inkscape build/zt-multiapp-desktop.svg \
    --export-type=png \
    --export-filename="build/icons/$SIZE"x"$SIZE.png" \
    --export-width="$SIZE" --export-height="$SIZE"
done
convert build/icons/16x16.png build/icons/32x32.png \
  build/icons/48x48.png build/icons/64x64.png \
  build/icons/128x128.png build/icons/256x256.png build/icon.ico
png2icns build/icon.icns build/icons/16x16.png \
  build/icons/32x32.png build/icons/128x128.png \
  build/icons/256x256.png build/icons/512x512.png
file build/icon.ico build/icon.icns build/icons/512x512.png
```

If any icon-generation command fails, fix it before building; do not silently fall back to the Electron icon. The explicit packaging overrides in the next steps use the generated files, leaving the repository's original SVG-backed `package.json` configuration unchanged. To permanently adopt the native icon paths in `package.json`, also update `tests/app-icon.test.js` and commit those changes before the release tag.

### 4. Build and verify Linux AppImage and DEB

First test the unpacked application:

```bash
npx electron-builder --linux dir --x64 \
  --config.linux.icon=build/icons --publish never
ELECTRON_ENABLE_LOGGING=1 ./dist/linux-unpacked/multiapp-showcase \
  --enable-logging=stderr
```

Once it opens successfully, build the packages:

```bash
npx electron-builder --linux AppImage deb --x64 \
  --config.linux.icon=build/icons --publish never
ls -lh dist/*.AppImage dist/*.deb
dpkg-deb -c dist/*.deb | grep -Ei '/applications/.*\.desktop|/icons/|\.png|\.svg'
```

Back up your existing user data before testing an upgrade. Install and launch the DEB:

```bash
sudo apt install ./dist/*.deb
dpkg -L multiapp-showcase | grep -E '\.desktop$|/icons/'
command -v multiapp-showcase
multiapp-showcase
```

The packaged executable may instead be under `/opt/multiapp-showcase/`. Run that exact file with `ELECTRON_ENABLE_LOGGING=1` and `--enable-logging=stderr` to diagnose startup failures. Check the actual installed desktop-file path before validating it:

```bash
DESKTOP_FILE="$(dpkg -L multiapp-showcase | grep '/applications/.*\.desktop

See [Enterprise Readiness](docs/ENTERPRISE_READINESS.md) for the current control inventory, threat model, backup recovery procedure, release policy and required production go/no-go checks. **This repository is not yet an enterprise-certified or production-approved distribution.**

## Security and limitations

- Embedded content is sandboxed with Node integration disabled, privileged IPC checks the main UI sender and frame, and web permission requests are denied. Allowed popup pages open in their originating tab's embedded view.
- Demo passwords are **not** placed inside bundled JSON defaults or sent to the web pages by the app. Copy and paste is manual. Legacy entries and existing recovery snapshots may still contain plaintext; new packaged builds refuse new plaintext password storage.
- An exported encrypted JSON file includes all demo passwords within its encrypted payload. Its AES-256-GCM key is derived from the export passphrase using scrypt (N=32768, r=8, p=1). Protect the export passphrase. The database itself is not encrypted.
- When upgrading from JSON, a legacy backup file may contain encrypted data from the previous installation. The migration retains this file for rollback/recovery.
- The OS encryption backend may differ by operating system or Linux desktop configuration. Secure storage is tied to the local OS environment and may not be portable to another machine.
- Some services do not support OAuth login in embedded browsers.
- Changing app URL changes the view's home URL but retains its app ID's stored session, including cookies. Configure only trusted websites.
- Native view windows currently hide while Settings or the demo drawer is open, then restore when closed.
- This is an MVP. Automated runtime end-to-end and accessibility tests are not yet included.
 | head -1)"
test -n "$DESKTOP_FILE"
desktop-file-validate "$DESKTOP_FILE"
grep -E '^(Name|Exec|Icon|StartupWMClass)=' "$DESKTOP_FILE"
gtk-launch "$(basename "$DESKTOP_FILE" .desktop)"
```

The launcher identity is `com.rykstudio.multiappshowcase.desktop`. Confirm the **branded icon** appears in the Ubuntu application grid **and** Dock, and that the program launches from both the menu and terminal. Remove an obsolete *development-only* launcher from `~/.local/share/applications/` if it shadows the packaged desktop entry; do not delete your settings database. Test the AppImage separately with `chmod +x dist/*.AppImage` and `./dist/*.AppImage`. If AppArmor or sandbox issues occur, diagnose the actual failure and use a narrowly scoped packaging/policy fix rather than shipping a sandbox-disabled application.

### 5. Cross-build Windows from Ubuntu with Wine

```bash
wine --version
npx electron-builder --win nsis portable --x64 \
  --config.win.icon=build/icon.ico --publish never
find dist -maxdepth 1 -type f -name '*.exe' -ls
```

This produces a Windows setup executable and a portable EXE. The Windows icon is supplied explicitly as an ICO. Verify the branded taskbar/Start menu icon and both executables on a **Windows machine** before marking them tested. A successful Wine cross-build by itself does not verify Windows runtime behaviour. Signed Windows installers require an appropriate signing setup.

### 6. Cross-package macOS on Ubuntu

The repository's `npm run build:mac` requests a universal DMG/ZIP through Electron Builder; do **not** rely on that script as a supported Ubuntu-only signed DMG workflow. Instead use [Electron Packager](https://github.com/electron/packager) to produce two independent unsigned `.app` bundles. Install it temporarily without changing `package.json` or the lockfile:

```bash
npm install --no-save --package-lock=false @electron/packager

for ARCH in x64 arm64; do
  npx electron-packager . "MultiApp Showcase" \
    --platform=darwin --arch="$ARCH" \
    --out=dist/mac-cross --overwrite --asar --prune=true \
    --icon=build/icon.icns \
    --app-bundle-id=com.rykstudio.multiappshowcase \
    --ignore='^/dist(/|$)' \
    --ignore='^/release-ready(/|$)' \
    --ignore='^/\.git(/|$)'
done
```

Archive each bundle on Linux **with symlinks preserved**. Run from the repository root:

```bash
ROOT="$PWD"
mkdir -p release-ready/v1.0.0
for ARCH in x64 arm64; do
  (
    cd "dist/mac-cross/MultiApp Showcase-darwin-$ARCH"
    zip -yr "$ROOT/release-ready/v1.0.0/MultiApp-Showcase-1.0.0-macOS-$ARCH.zip" \
      "MultiApp Showcase.app"
  )
  unzip -t "release-ready/v1.0.0/MultiApp-Showcase-1.0.0-macOS-$ARCH.zip" >/dev/null
done
find dist/mac-cross -name '*.icns' -o -name Info.plist
```

These are **unsigned, unnotarized macOS test distributions**, **not DMGs**. Test the x64 build on an Intel Mac and the ARM64 build on Apple Silicon. macOS Gatekeeper may block unsigned applications. Producing a signed/notarized release requires access to a Mac, an Apple Developer identity, and Apple's signing/notarization services.

### 7. Stage packages and create checksums

```bash
mkdir -p release-ready/v1.0.0
find dist -maxdepth 1 -type f \
  \( -name '*.AppImage' -o -name '*.deb' -o -name '*.exe' \) \
  -exec cp -v {} release-ready/v1.0.0/ \;

ls -lh release-ready/v1.0.0/
(
  cd release-ready/v1.0.0
  sha256sum *.AppImage *.deb *.exe *.zip > SHA256SUMS.txt
  sha256sum -c SHA256SUMS.txt
)
```

Require two Linux packages, two Windows EXEs, two macOS ZIPs and the checksum file before publishing. Do not upload failures, stale files, or packages you have not tested on the appropriate platform. Packages may be large; confirm network upload bandwidth and available GitHub Release storage.

### 8. Disable Actions and handle prior releases carefully

GitHub Actions minutes are not necessary for manual releases. If you want to prevent the repository's push/PR workflows from running when you push documentation, source, or a tag, disable Actions under **Settings → Actions → General** in GitHub before the push.

Check the existing release/tag:

```bash
gh release list -R rykstudio/multiapp-showcase --limit 100
gh release view v1.0.0 -R rykstudio/multiapp-showcase || true
git ls-remote --tags origin refs/tags/v1.0.0
```

**Do not delete an existing v1.0.0 release or tag automatically.** Deleting a release breaks existing download links and discards assets. If you intentionally need a clean reset after backing up anything worth keeping:

```bash
gh release delete v1.0.0 \
  -R rykstudio/multiapp-showcase --cleanup-tag --yes
git tag -d v1.0.0 2>/dev/null || true
```

For other obsolete releases, inspect `gh release list` and delete named tags one by one. Only reset versions that you explicitly intend to replace.

### 9. Tag the tested commit and create a draft Release

Make sure source changes are committed and that the installer packages correspond to that commit:

```bash
git status --short
git rev-parse HEAD
git tag -a v1.0.0 -m "MultiApp Showcase v1.0.0"
git push origin v1.0.0

gh release create v1.0.0 \
  -R rykstudio/multiapp-showcase \
  --verify-tag --draft \
  --title "MultiApp Showcase v1.0.0" \
  --notes "Linux x64 AppImage/DEB; Windows x64 Setup/Portable; unsigned macOS Intel and Apple Silicon ZIPs. See README for installation, verification, and unsigned macOS restrictions."
```

If `v1.0.0` already exists, review whether it already points at the correct tested commit rather than force-moving an existing tag.

### 10. Upload artifacts manually and verify

The GitHub CLI can stall silently on a slow/blocked connection. First check API connectivity with `gh api rate_limit` and upload the small checksum file:

```bash
gh api rate_limit --jq '.rate.remaining'
gh release upload v1.0.0 release-ready/v1.0.0/SHA256SUMS.txt \
  -R rykstudio/multiapp-showcase
```

Then upload the binaries **one by one** so any failure is easy to identify:

```bash
find release-ready/v1.0.0 -maxdepth 1 -type f \
  ! -name SHA256SUMS.txt -print0 |
while IFS= read -r -d '' FILE; do
  echo "Uploading $(basename "$FILE")"
  gh release upload v1.0.0 "$FILE" -R rykstudio/multiapp-showcase
done
```

Verify assets and their sizes:

```bash
gh release view v1.0.0 -R rykstudio/multiapp-showcase \
  --json assets \
  --jq '.assets[] | [.name,.size,.state] | @tsv'
```

If an upload stalls, check the actual GitHub CLI connection and routing, stop only the stalled upload, and retry the missing asset. Avoid `--clobber` unless you deliberately intend to replace an uploaded asset: it removes the old asset before uploading its replacement.

After every required asset is present and tested, publish:

```bash
gh release edit v1.0.0 -R rykstudio/multiapp-showcase --draft=false
gh release view v1.0.0 -R rykstudio/multiapp-showcase
```

Release page: [MultiApp Showcase v1.0.0](https://github.com/rykstudio/multiapp-showcase/releases/tag/v1.0.0).

### Installation instructions for end users

**Ubuntu/Linux (DEB):** Download the matching amd64 `.deb` and run `sudo apt install ./FILENAME.deb` in the download directory. Start **MultiApp Showcase** from the application grid or run `multiapp-showcase`. Test that the Dock icon is the branded icon. If the process does not open, run the installed binary from Terminal to capture the startup error rather than repeatedly reinstalling it. Do not delete your saved SQLite configuration to troubleshoot an installer.

**Linux (AppImage):** Download the x64 `.AppImage`, run `chmod +x "FILENAME.AppImage"` and then `./FILENAME.AppImage`. AppImage integration into the applications grid is not guaranteed; use a trusted desktop integration mechanism if a launcher is desired.

**Windows:** Download either the `Setup 1.0.0.exe` installer or the portable EXE. Launch the installer for a normal Windows installation, or run the portable executable without installing. Windows SmartScreen may warn about unsigned executables; download only from the official repository and verify its SHA-256. The portable build's data-storage location may differ from a conventional installation; check persistence before migration.

**macOS:** Download the correct x64 ZIP for an Intel Mac or arm64 ZIP for an Apple Silicon Mac. Extract the ZIP, then move `MultiApp Showcase.app` to Applications. These Linux-built ZIPs are unsigned/unnotarized; macOS may reject them via Gatekeeper. Only use them for trusted testing until signed, notarized macOS builds are available. Avoid disabling system-wide Gatekeeper protections.

**Verify downloads:** Download `SHA256SUMS.txt` with the release files. On Linux run `sha256sum -c SHA256SUMS.txt` from the directory containing all listed assets; for a single asset, use `sha256sum "FILENAME"` and compare it to the matching checksum line. On other platforms use their equivalent SHA-256 tooling.

### Upgrade and uninstall behaviour

Application settings, demo-login groups and encrypted credentials are kept in the user's Electron data directory, not in the source checkout. Back up that directory before making a major change, especially when testing database migrations. Reinstalling or upgrading a DEB should not require deleting personal configuration; `apt remove` normally leaves per-user data intact. Changing an app ID changes its isolated Chromium partition, so prefer editing the display name rather than changing IDs for cosmetic reasons.

### Release verification checklist

- All automated tests pass, including legacy SQLite migration and long-ID/group tests.
- The unpacked Linux application, installed DEB and AppImage all launch normally.
- The DEB contains a desktop entry and branded icon resources; the Ubuntu app grid and Dock show the correct icon.
- Windows setup and portable EXEs start with the correct icon on Windows.
- Both macOS ZIPs contain `.app` bundles and native icon resources, unzip successfully, and have been tested on the respective Macs.
- Grouped demo logins, import/export, password storage and browser sessions continue working across restarts.
- The Git tag matches the tested source commit, release assets and checksums are complete, and only then is the draft release published.


## Production and enterprise hardening

See [Enterprise Readiness](docs/ENTERPRISE_READINESS.md) for the current control inventory, threat model, backup recovery procedure, release policy and required production go/no-go checks. **This repository is not yet an enterprise-certified or production-approved distribution.**

## Security and limitations

- Embedded content is sandboxed with Node integration disabled, privileged IPC checks the main UI sender and frame, and web permission requests are denied. Allowed popup pages open in their originating tab's embedded view.
- Demo passwords are **not** placed inside bundled JSON defaults or sent to the web pages by the app. Copy and paste is manual. Legacy entries and existing recovery snapshots may still contain plaintext; new packaged builds refuse new plaintext password storage.
- An exported encrypted JSON file includes all demo passwords within its encrypted payload. Its AES-256-GCM key is derived from the export passphrase using scrypt (N=32768, r=8, p=1). Protect the export passphrase. The database itself is not encrypted.
- When upgrading from JSON, a legacy backup file may contain encrypted data from the previous installation. The migration retains this file for rollback/recovery.
- The OS encryption backend may differ by operating system or Linux desktop configuration. Secure storage is tied to the local OS environment and may not be portable to another machine.
- Some services do not support OAuth login in embedded browsers.
- Changing app URL changes the view's home URL but retains its app ID's stored session, including cookies. Configure only trusted websites.
- Native view windows currently hide while Settings or the demo drawer is open, then restore when closed.
- This is an MVP. Automated runtime end-to-end and accessibility tests are not yet included.
