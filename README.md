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

## Import settings and download a template

Open **Settings** and choose **Download JSON template** to save `multiapp-settings-template.json` to your computer. It includes four sample applications, two with multiple demo accounts, a mobile example, and a hidden app. Samples demonstrate groups, order and theme. Replace the example `.example.com` URLs and usernames with your own details.

Click **Import settings JSON** and select a JSON file using the same structure. If the file is an encrypted export, enter its export password to decrypt it before previewing. The app validates the format, application IDs, URLs, demo-login IDs and field lengths, then shows a **preview**. The imported apps replace the current **draft** settings, not your saved configuration. Review them and click **Save changes** to apply or **Cancel** to discard.

The JSON includes global `tabLayout` (`horizontal` or `vertical`), `sidebarCollapsed` (`true` or `false`), and `sidebarWidth` (180 to 420 pixels), as well as global `theme` (`auto`, `light`, `dark`) and, for every application, `group`, `hidden`, `displayMode` and optionally `order`. `group` is a case-sensitive label up to 64 characters. Set `hidden: true` to remove the app from tabs without deleting its saved configuration or browser session. If `order` is used, provide a distinct nonnegative index on every app; otherwise array order applies. Collapsed and expanded editor sections are temporary interface state and are intentionally not exported.

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

## Horizontal and vertical application tabs

MultiApp Showcase supports two layouts, both selectable from the toolbar or Settings. The selected layout is saved in SQLite and included in JSON import/export.

- **Horizontal tabs:** The entire upper row belongs to application tabs, group filter, overflow chevrons and the searchable dropdown. Full screen, Settings, navigation, responsive preview and window controls share the lower address toolbar.
- **Vertical sidebar:** A left-hand list of application tabs with rounded initial-letter icons, labels and group information. Use the chevron at the sidebar top to collapse to a slim 56-pixel icon rail, or expand back to the saved width (180–420 pixels). Resize by dragging the sidebar edge or using arrow keys when the resize separator has focus. Use the search button to open the existing keyboard-accessible tab picker.
- The sidebar is hidden while Settings is open; embedded web views automatically reposition to avoid covering the sidebar. Saved app IDs, browser sessions, tabs, demo logins, and the mobile phone-preview remain unchanged.

## Workspace appearance, groups, visibility and demo accounts

**Appearance:** In **Settings**, choose **Auto (system)**, **Light**, or **Dark**. The desktop browser chrome follows that setting; Auto follows the operating system. Embedded websites receive the corresponding native Chromium colour-scheme preference but may retain their own theme controls.

**Grouping:** Assign the same optional group name to related applications, such as Operations, Sales or Personal. When two or more groups are present among visible applications, the tab bar gains a group selector. Choose a group to see only its apps; the all-apps view and searchable tab picker remain available. Group names are editable per application and are preserved in SQLite and JSON import/export.

**Hide versus delete:** The **Hide / Show** control is available directly on each application accordion header, even when collapsed. Hidden applications remain in Settings with their IDs, URLs, demo accounts and browser partitions intact. They are excluded from tab navigation and group filtering; unhiding restores access. **Delete** remains a separate action inside the expanded application panel and removes the entry from saved configuration.

**Ordering:** Drag a header's grip to rearrange applications, or use its always-visible up/down arrows. Changes stay in the Settings draft until you click **Save changes**. Explicit JSON `order` values are supported, but the app's displayed sequence is authoritative once edited.

**Demo accounts:** Login configurations sit within the owning application's accordion as compact nested disclosure panels, with readable titles, usernames and password-status badges. Expand individual accounts to edit the description, username or demo password. None of these UI expansion states are stored in JSON.

## Handling many tabs

The tab bar hides the native horizontal scrollbar and uses subtle left and right chevrons only when tabs overflow. The active tab automatically scrolls into view as you switch tabs. Use the **▾** tab switcher to search all applications by name or URL, or press **Ctrl+K** (Windows/Linux) or **Cmd+K** (macOS). Mouse-wheel scrolling over the tab bar also moves through overflowed tabs. The tab strip keeps its position during page loading and preserves existing isolated browser sessions.

## Collapsible settings and demo logins

The Settings page uses native keyboard-accessible disclosure sections. Applications are listed as compact rows with the app name, Desktop/Mobile mode and number of demo logins. Expand only the application you need, or use **Expand all** / **Collapse all**. Each demo login also has an independent collapsible editor displaying its title and username, plus **Expand logins** / **Collapse logins** within the application. The first application opens by default. Newly added apps and logins open automatically for editing. Collapsing does not save, discard or alter fields, browser sessions or SQLite settings. Click **Save changes** to persist any actual edits.

The **☰ Logins** drawer within a running website now uses its own compact collapsible demo account cards, so large numbers of demo accounts do not create an excessively long panel. The first demo account opens initially and collapsed state is remembered while the application is running.

## Demo login editor

Under each website, use **+ Add demo login** to add as many as 50 demo accounts with separate titles and descriptions. Complete the title and username (and optionally a password), then click **Save changes**. If the OS secure credential store is unavailable, packaged builds refuse new passwords and display a warning. Existing legacy plaintext values may remain until cleared or reencrypted. Do not use demo credentials as production passwords.

## Managing applications

Use the **Settings** button in the top-right of the app. Enter the application title and its name, unique stable ID and URL. Then add optional demo logins. Click **Save changes**. The changes persist across launches.

On first launch, Electron creates `multiapp-settings.sqlite` in its user-data directory. Existing installations automatically migrate apps and demo-login values from the previous `apps.json` file into SQLite, preserving app IDs and Chromium sessions. The old JSON file is kept as `apps.json.pre-sqlite-backup` for recovery. New installations seed the database from bundled `config/apps.json`. The settings editor reads and writes SQLite, not the JSON file. No remote database is required.

### Reordering tabs

In **Settings**, drag the ⠿ handle on any application accordion header to reorder, or use **↑** and **↓** controls directly on the collapsed header. Reordering does not require expanding an application. The numbered entries show the intended left-to-right tab sequence. Click **Save changes** and the tab strip updates immediately. The order is persisted in the application's SQLite database and is restored after closing and reopening the desktop application. Reordering does not change an app ID or clear its isolated browser session. Reordering behaviour is covered by automated regression tests in `tests/app-order.test.js`.

App IDs should be 1 to 48 characters using letters, numbers, underscores and dashes. Changing an app ID creates a new browser session, so old authentication may not carry over. Deleting an app does not automatically purge Chromium's session partition.

## Application branding and icons

The original ZT artwork is retained unchanged at `build/zt-multiapp-desktop.svg`. Electron Builder v26 uses that vector source to generate native Windows, macOS and Linux installer icons.

**Development mode:** `npm start` bypasses electron-builder's launcher setup. Electron's desktop window therefore explicitly loads the rasterized `src/assets/zt-app-icon.png`, generated from the same SVG. On macOS, development runs set the Dock icon using `app.dock.setIcon`; installed .app bundles embed the platform icon from the vector source. On Linux, the window/taskbar uses the bundled PNG, while installed packages use their launcher icon.

If `npm start` is already running after pulling the changes, fully quit the Electron process and start it again. Desktop environments sometimes cache launcher icons: clear the stale pinned launcher and reopen the freshly built package if its icon remains generic.


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

### Move this prepared branch into a new GitHub repository

Create an **empty private** GitHub repository named `rykstudio/multiapp-showcase` (do not initialize it with a README, license, or .gitignore). From a local clone of `rykstudio/multiapp-desktop`:

```bash
git fetch origin ui/full-width-tabs-toolbar-actions
git switch ui/full-width-tabs-toolbar-actions
git remote add showcase https://github.com/rykstudio/multiapp-showcase.git
git push -u showcase HEAD:main
```

This pushes only the finished branch to the new repository's `main`; it does not transfer old release tags or modify `multiapp-desktop`. You can then clone the new repository directly for future development.

The packages bundle Electron and do not require Node.js installed by end users. Linux may still require compatible system libraries. Windows signing and macOS signing/notarization are not configured.

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
