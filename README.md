<div align="center">
  <img src="public/logo.png" alt="MacroHard Todo" width="84" height="84" />
  <h1>MacroHard Todo</h1>
  <p><strong>A local-first, fast, and calm desktop task manager</strong> — familiar to Microsoft To Do users, with 100% of your data staying in your own hands.</p>

  <p>
    <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
  </p>

  <p>
    <a href="https://github.com/lei-ctyh/MacroHardTodo/releases"><img src="https://img.shields.io/github/v/release/lei-ctyh/MacroHardTodo?include_prereleases&style=flat-square&color=2564cf" alt="Release" /></a>
    <a href="https://github.com/lei-ctyh/MacroHardTodo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/lei-ctyh/MacroHardTodo/ci.yml?branch=master&style=flat-square&label=CI" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square" alt="React 18" />
  </p>
</div>

> MacroHard Todo is an independent open-source project not affiliated with Microsoft and contains no Microsoft icons, images, or trademarks. UI icons come from [Lucide](https://lucide.dev/) (ISC license), and the 14 built-in scenic wallpapers are curated **CC0** public-domain photographs from Openverse and Wikimedia Commons.

---

## Why MacroHard Todo

Microsoft To Do has been my daily driver for years — its calm "My Day / Planned / List Groups / Right Detail Pane" workflow genuinely gets things done.

Over time, though, it started feeling left behind: updates slowed to a crawl, long-requested features like a calendar view never arrived, and even small paper cuts — like not being able to hide or remove the *"Flagged email"* smart list when you don't use a Microsoft mailbox — stayed unfixed. With its future now uncertain and shutdown/migration looming, waiting on someone else wasn't an option — **so I built my own**.

Built with **Tauri v2 + React + Rust**, **MacroHard Todo** keeps everything that made the workflow effortless while putting you back in full control:

- **Local-First Forever**: All tasks, attachments, avatars, and custom wallpapers live directly on your disk — instant startup offline, zero account lock-in, immune to any cloud shutdown.
- **Actually Yours to Customize**: Toggle any smart list (Important / Planned / All / Completed) on or off without undeletable clutter — and keep iterating on real community requests like calendar views, focus timers, and natural-language dates.
- **One-Click Migration**: Built-in Microsoft Graph device-code wizard imports your existing Microsoft To Do lists, tasks, steps, due dates, reminders, importance, recurrence, and notes.
- **Bring Your Own Sync**: Sync across devices with any WebDAV server (Jianguoyun / Nextcloud / Synology NAS, etc.) with optional **AES-256-GCM + Argon2** end-to-end encryption.

---

## Download & Install

Grab the latest build from [**GitHub Releases**](https://github.com/lei-ctyh/MacroHardTodo/releases):

| Platform | Recommended Installer | Alternative |
| --- | --- | --- |
| **Windows (x64)** | `*_x64-setup.exe` (NSIS installer, no admin required) | `*_windows_x64_portable.zip` (portable archive) |
| **macOS (Apple Silicon)** | `*_aarch64.dmg` | — |
| **macOS (Intel)** | `*_x64.dmg` | — |
| **Linux (x64)** | `*.AppImage` (universal) | `*.deb` (Debian / Ubuntu) |

> **OS Gatekeeper / SmartScreen Notice**: As an independent open-source project without a paid code-signing certificate:
> - **Windows**: If SmartScreen shows *"Windows protected your PC"*, click **More info → Run anyway**.
> - **macOS**: If macOS blocks the unverified developer, open **System Settings → Privacy & Security** and click **Open Anyway**.
> - Every release asset is compiled transparently by GitHub Actions from public source and includes `SHA256SUMS.txt` for integrity verification.

---

## Key Features

### Tasks & Lists
- **Default & Custom Lists**: Fixed default "Tasks" list plus unlimited custom lists, collapsible list groups with drag-and-drop reordering, and automatic leading-emoji list icons.
- **Smart Views**: My Day, Important, Planned (grouped by Overdue / Today / Tomorrow / Next 5 Days / Later), All (grouped by list), and Completed (dedicated archive with one-click restore). Toggle visibility and auto-hide empty smart lists in Settings.
- **Rich Task Attributes**: Title, subtasks/steps (progress tracking + "Promote to task"), due date & time, desktop notification reminders, importance stars, recurrence rules (daily / weekdays / weekly / monthly / yearly / custom interval & end date, plus one-click jump to current occurrence for overdue recurring tasks), tags, local attachments, and notes.
- **Fast Workflows**: Full task context menu (My Day, Star, Complete, Quick Reschedule, Move-to-List flyout, Delete), drag-and-drop sorting, instant global search across titles/notes/tags/steps, and a persistent bottom quick-add bar.
- **My Day Experience**: Centered welcome card plus a collapsible Suggestions side panel (Overdue / Today / Later / Recently Added); closing a task opened from Suggestions returns seamlessly to Suggestions.

### Themes & Personalization
- **Light / Dark / System**: Deep dark-mode polish — pure color themes render on a calm `#1f1f1f` dark canvas with luminous foreground accents, while photo themes pair dark frosted pills and neutral slate accents.
- **Rich Backgrounds**: Every list and smart view can independently pick from **14 CC0 HD scenic wallpapers**, **14 gradient color themes**, or any local custom image (synced via WebDAV).
- **Dedicated Settings Page**: Custom profile name/subtitle/avatar, new-task insertion order, move-starred-to-top, completion chime, delete confirmation, start-of-week preference, auto-purge old completed tasks, launch at startup, and minimize to tray on close.

### Data Ownership, Sync & Migration
- **Auto-Save & Local Backups**: Automatic daily snapshots kept for 21 days, plus JSON and CSV import/export.
- **WebDAV Sync**: Presets for Jianguoyun, Nextcloud, and Synology NAS; timestamp-based merge (`updatedAt` + device ID tie-breaker), tombstone deletes, `If-Match` conflict retry, on-demand attachment sync, and optional **AES-256-GCM + Argon2** end-to-end encryption.
- **Microsoft To Do Migration**: Microsoft Graph device-code login with selective list preview and `sourceId` deduplication so re-running never creates duplicates.

---

## Keyboard Shortcuts

| Shortcut | Scope | Action |
| --- | --- | --- |
| `Ctrl + Alt + T` | Global (even when minimized to tray) | Show window and focus Quick Add |
| `Ctrl + T` | Selected task | Add to / remove from My Day |
| `Ctrl + D` | Selected task | Toggle completed |
| `Delete` | Selected task / context menu | Delete task (respects confirmation setting) |
| `Enter` | Inline editors | Submit creation or rename |
| `Esc` | Modals / detail / editors | Close dialog, close detail pane, or cancel edit |

---

## Data Storage Locations

All data is stored locally (upgrading or reinstalling preserves your data):

| Platform | Default Data Directory |
| --- | --- |
| **Windows** | `%APPDATA%\com.macrohardtodo.app\` |
| **macOS** | `~/Library/Application Support/com.macrohardtodo.app/` |
| **Linux** | `~/.local/share/com.macrohardtodo.app/` |

Directory layout:
- `todo-data.json`: primary database file
- `backups/todo-YYYY-MM-DD.json`: last 21 days of automatic daily snapshots
- `attachments/`: local attachments, custom avatars, and uploaded wallpapers

---

## WebDAV Sync Setup (Example: Jianguoyun)

1. Create a folder in your WebDAV drive (e.g., `MyTasks`).
2. Generate an **App Password** in your provider's security settings.
3. Open **Settings → Sync** in MacroHard Todo, pick the provider preset, and enter:
   - **URL**: `https://dav.jianguoyun.com/dav/MyTasks`
   - **Username**: your login email
   - **Password**: your app password
4. Click **Test Connection**, then **Save & Sync** (creates `MacroHardTodo/data.json` automatically).

> If end-to-end encryption is enabled, only ciphertext is stored remotely. **Keep your passphrase safe — it cannot be recovered if lost.**

---

## Migrating from Microsoft To Do

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID → App registrations → New registration**.
2. Choose any name, select **Personal Microsoft accounts only** (or **Accounts in any organizational directory and personal Microsoft accounts**), leave Redirect URI empty, and click **Register**.
3. Copy the **Application (client) ID**.
4. Open **Authentication** → enable **Allow public client flows** → **Save**.
5. Open **API permissions** → **Add a permission → Microsoft Graph → Delegated permissions** → add `Tasks.Read`.
6. In MacroHard Todo, open **Settings → Migrate from Microsoft To Do**, paste the Client ID, and follow the device-code flow.

> Due to Microsoft Graph API limitations, historical My Day assignments and Flagged Emails cannot be imported.

---

## Development & Building

### Prerequisites

- **Node.js** 20+
- **Rust** stable toolchain
- **Windows**: Visual Studio Build Tools (Desktop development with C++ + Windows SDK) and WebView2
- **macOS**: Xcode Command Line Tools
- **Linux (Ubuntu/Debian)**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libsecret-1-dev`

### Commands

```bash
# Install dependencies
npm install

# Run in development (Vite HMR + Tauri window)
npm run tauri dev

# Typecheck & unit tests
npx tsc --noEmit
npm test

# Build desktop installer (outputs to src-tauri/target/release/bundle/)
npm run tauri build

# Bump version across package.json, tauri.conf.json, and Cargo.toml
npm run bump 0.2.0
```

### Project Layout

```text
src/                 Frontend (React 18 + TypeScript + Zustand)
  components/        UI views and components
  lib/               Data model, dates/recurrence, view grouping, sync & Graph mapping
  store/             Global state and persistence
src-tauri/           Rust backend (storage, OS keyring, WebDAV, Graph, AES-GCM, tray)
public/backgrounds/  14 built-in CC0 scenic wallpapers
tests/               Vitest unit tests
scripts/             Release and version helper scripts
```

---

## License & Credits

- Source code is licensed under the [MIT License](LICENSE).
- UI icons by [Lucide](https://lucide.dev/) (ISC License).
- 14 built-in scenic wallpapers sourced from Openverse & Wikimedia Commons under **CC0** (Public Domain).
