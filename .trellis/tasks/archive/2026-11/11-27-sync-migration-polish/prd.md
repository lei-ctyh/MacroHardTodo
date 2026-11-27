# Polish SyncDialog and MigrationWizard UI

## Goal

Redesign `SyncDialog` and `MigrationWizard` into clean, compact Fluent modals matching the newly redesigned `SettingsPage` — eliminating walls of explanatory text, replacing native browser checkboxes/disclosure triangles with Fluent controls, fixing oversized button icons, and guiding users through visual presets and a step indicator.

## Confirmed Facts

- `src/components/SyncDialog.tsx` currently renders a top blue Jianguoyun tutorial banner, three small-print hint paragraphs under inputs, a native `<input type="checkbox">` for encryption, an oversized 24px `SyncIcon` inside the primary button, and a bottom yellow warning banner explaining LWW merge and tombstones.
- `src/components/MigrationWizard.tsx` currently uses `<Modal wide>` (680px), renders top blue and bottom yellow explanatory banners, an input hint, a raw `<details>` triangle for Entra setup steps, an oversized 24px `PersonIcon` in the login button, and plain `settings-line` rows for completion stats.
- Both dialogs are opened from `SettingsPage` (and `SyncDialog` also from `Sidebar` account menu) via `useStore.openDialog("sync" | "migration")`.
- Neither modal requires any Rust backend, data model, or store changes — all transport (`api.webdav*`, `api.secret*`, `api.graph*`) and merge/import logic (`syncClient.ts`, `graphImport.ts`) stays unchanged.

## Requirements

### R1. Shared Fluent `ToggleSwitch` Component
- Extract `ToggleSwitch` (`role="switch"`, `aria-checked`, optional `showText`) into `src/components/ToggleSwitch.tsx` so `SettingsPage` and `SyncDialog` share one consistent Fluent switch.

### R2. `SyncDialog` Redesign
- Replace top blue Jianguoyun banner with interactive service-provider preset pills (`坚果云` / `Nextcloud` / `自定义`) that adapt placeholders, password label (`应用密码` vs `密码 / 应用密码`), and pre-fill URL prefix when appropriate.
- Clean compact form layout: full-width `WebDAV 地址` input + two-column `用户名` and `密码` row, with zero small-print hint lines underneath.
- Replace native checkbox with Fluent `ToggleSwitch` row (`端到端加密` + subtle `AES-256` pill); toggling ON reveals the `加密口令` input cleanly.
- Remove the bottom yellow tombstone/LWW banner.
- Show compact inline sync/test status feedback (only when relevant, e.g., test result, sync error/message, or last sync time).
- Footer layout: `测试连接` on the left, `取消` and `保存并同步` (with `size={14}` icon) on the right.

### R3. `MigrationWizard` Redesign
- Use standard modal width (`520px`) with a clean 4-step progress indicator at top (`配置` → `登录授权` → `选择列表` → `完成`).
- **Config step**: remove blue/yellow banners and input hint; clean `应用程序 (客户端) ID` field; replace raw `<details>` with a Fluent collapsible disclosure (`如何获取客户端 ID` with chevron + soft-surface numbered steps + Azure Portal link button).
- **Auth step**: centered device-code card with prominent monospace code + `复制代码` button, compact waiting indicator, and `重新打开登录页` action.
- **Fetching step**: clean centered loading spinner and live progress label.
- **Preview step**: concise summary bar (`N 个列表 · X 个任务`) with `全选 / 取消全选` toggle and clean selectable list rows with task counts.
- **Done step**: centered completion header + 3-column stat cards (`新建列表` / `新建任务` / `跳过已存在`), without the bottom yellow banner.
- Fix all button icon sizes to `14px` (`PersonIcon`, `BackIcon`, `DownloadIcon`, `CopyIcon`, `OpenIcon`, `CheckIcon`).

### R4. Styling & Theme Parity
- All new styles live in `src/styles.css` using existing CSS variables (`--bg-main`, `--bg-sidebar`, `--border`, `--accent`, `--accent-soft`, `--danger`, etc.), looking crisp in both light and dark modes.
- Fix `.btn svg` default sizing so icons inside `.btn` never balloon to 24px.

## Out of Scope

- Changing WebDAV sync protocol, encryption format, or Microsoft Graph OAuth/import logic
- Turning either dialog into a full-window Settings sub-page

## Acceptance Criteria

- [ ] `SyncDialog` displays provider presets, two-column username/password, Fluent encryption toggle, clean footer (`测试连接` left, `取消` / `保存并同步` right), and zero instructional alert banners or field hint walls.
- [ ] `MigrationWizard` displays a 4-step visual stepper, Fluent collapsible Entra guide, centered device-code card, preview list picker with select-all toggle, and 3-column completion stat cards, with zero blue/yellow instructional banners.
- [ ] All button icons in both dialogs render cleanly at 14px without oversized distortion.
- [ ] All existing behaviors (WebDAV test, secret save, syncNow, Graph device flow, polling, selective import, dedupe) continue working identically.
- [ ] Both dialogs look clean in light and dark modes.
- [ ] `tsc --noEmit`, `vitest run`, and `vite build` pass with zero errors.
