# Journal - zhanglei (Part 1)

> AI development session journal
> Started: 2026-11-24

---



## Session 1: UI alignment: context menus, emoji icons, Fluent title, responsive polish
<!-- trellis-session: v=2 fp=8fe919022607141b -->

**Date**: 2026-11-26
**Task**: UI alignment: context menus, emoji icons, Fluent title, responsive polish
**Branch**: `master`

### Summary

Continued the Microsoft To Do UI alignment task: unified frosted empty-state box size/opacity and Microsoft hint copy; added group press/release spring feedback and whole-section right-click for empty groups; portaled group/list context menus to document.body to fix fixed-position drift under transformed ancestors; custom-list right-click menu with rename, move-to-group flyout and delete; inline new-list now commits on blur as well as Enter; leading emoji in custom list names renders as the list icon (new lib/emoji.ts + tests); content title resized to Fluent Title2 28/36. All checks (npm test 53, tsc, build) pass; commits pushed to origin/master.

### Git Commits

| Hash | Message |
|------|---------|
| `b4f23f7` | style: size the content title to Fluent Title2 |
| `a09cc10` | feat: add list context menus and emoji list icons |
| `562e9d2` | feat: add responsive sidebar and polish empty states |

### Status

[OK] **Completed**


## Session 2: View grouping: planned date buckets, per-list groups, theme accents
<!-- trellis-session: v=2 fp=58e0f1a7b8a89f17 -->

**Date**: 2026-11-26
**Task**: View grouping: planned date buckets, per-list groups, theme accents
**Branch**: `master`

### Summary

Implemented Microsoft To Do-style view grouping: planned date buckets (overdue/today/tomorrow/next 5 days/later) with completed tasks kept inline; All and Completed grouped by list with persisted per-view collapse state; completed sections for My Day and Important; deleting a list now moves its tasks to the default list; importance stars are always visible and stars/checkboxes use the theme accent color. Added SectionHeader plus grouping, delete-list and collapse tests. npm test 75, tsc and build pass.

### Git Commits

| Hash | Message |
|------|---------|
| `0430ccf` | feat: group tasks by view and theme row accents |
| `4e4f468` | docs(spec): document view grouping and theme accents |

### Status

[OK] **Completed**


## Session 3: Task detail panel and recurrence UX polish
<!-- trellis-session: v=2 fp=6dcf551041341657 -->

**Date**: 2026-11-27
**Task**: Task detail panel and recurrence UX polish
**Branch**: `master`

### Summary

Rebuilt TaskDetail into card sections with theme-accented reminder/due/repeat rows and an overdue-recurrence catch-up banner; added DateTimePicker (react-day-picker) and RepeatDialog with portaled popovers; preserved monthly/yearly anchor days, defaulted missing due date to today, and extended recurrence tests. Added Trellis Antigravity adapter and updated frontend specs.

### Git Commits

| Hash | Message |
|------|---------|
| `3c41d57` | feat: polish task detail panel and recurrence UX |
| `29b2aad` | chore(trellis): add Antigravity adapter |
| `ba3dc06` | docs(spec): document task detail panel and recurrence UX |

### Status

[OK] **Completed**


## Session 4: Settings page redesign: full-window layout, preferences, Fluent polish
<!-- trellis-session: v=2 fp=8a8d1fa5ce40a6f3 -->

**Date**: 2026-11-27
**Task**: Settings page redesign: full-window layout, preferences, Fluent polish
**Branch**: `master`

### Summary

Replaced SettingsDialog with a full-window Microsoft To Do-style SettingsPage (sticky back bar, profile header with shared useAvatar hook, Fluent pill switches, vertical theme radios, borderless Fluent action rows for Sync & Data, grouped About card with theme-colored Star banner). Added local preferences: addTasksOnTop, moveStarredToTop, playCompletionSound (Web Audio chime), confirmBeforeDelete (ConfirmDialog), weekStartsOn (DateTimePicker), smartListVisibility, autoHideEmptySmartLists, showDueTodayInMyDay; fixed stuck dataDir loading state. Updated frontend specs and added 7 unit tests (84/84 pass, tsc and build green).

### Git Commits

| Hash | Message |
|------|---------|
| `27087cf` | feat: redesign settings as a full-window page with general and smart-list preferences |
| `d44fee1` | docs(spec): document full-window settings page and preferences |
| `fd25886` | style(settings): unify sync and data section as borderless Fluent action rows |

### Status

[OK] **Completed**


## Session 5: Polish sync and migration modals, fix WebDAV 409 and auth retry
<!-- trellis-session: v=2 fp=df09f19433018f16 -->

**Date**: 2026-11-27
**Task**: Polish sync and migration modals, fix WebDAV 409 and auth retry
**Branch**: `master`

### Summary

Extracted shared ToggleSwitch; redesigned SyncDialog (provider presets, two-column credentials, Fluent encryption switch, unified green/error status bar) and MigrationWizard (4-step indicator, Fluent collapsible Entra guide, centered device code card, select-all preview, 3-column stats); fixed .btn svg icon sizing; fixed Jianguoyun HTTP 409 by probing base folder via resolveTestUrl and creating parent dirs in doSync; added automatic network-error retry in Graph device-code polling. 11 test files / 86 tests, tsc and vite build pass.

### Git Commits

| Hash | Message |
|------|---------|
| `c6e3300` | feat: polish sync and migration modals, fix WebDAV 409 and auth retry |
| `e96d00a` | docs(spec): document shared ToggleSwitch component |

### Status

[OK] **Completed**


## Session 6: Customizable profile modal and native context menu guard
<!-- trellis-session: v=2 fp=b0306cff2994a4d3 -->

**Date**: 2026-11-27
**Task**: Customizable profile modal and native context menu guard
**Branch**: `master`

### Summary

Replaced hardcoded local user/data strings with customizable profileName and profileSubtitle resolved via profileDisplay (fallback to MacroHard Todo and configured WebDAV user); built a centered-avatar Edit Profile modal in SettingsPage; fixed input focus double-ring and Escape modal guard in App; disabled default WebView2 browser context menu outside editable inputs and text selections. 87/87 tests, tsc and vite build pass.

### Git Commits

| Hash | Message |
|------|---------|
| `a67a604` | feat: add customizable profile modal and disable native browser context menu |
| `2e5c221` | docs(spec): document profile modal and global contextmenu guard |

### Status

[OK] **Completed**


## Session 7: Task row right-click context menu and shortcuts
<!-- trellis-session: v=2 fp=c1054e70af6411cf -->

**Date**: 2026-11-27
**Task**: Task row right-click context menu and shortcuts
**Branch**: `master`

### Summary

Added portaled TaskContextMenu matching Microsoft To Do proportions (264px width, 38px rows, muted 18px icons, state-specific circle/star-off/calendar/list-move icons, full-bleed separators) with My Day, importance, complete, due-date presets + portaled DateTimePicker, auto-flipping move-to-list flyout, and confirm-aware delete. Wired Ctrl+T, Ctrl+D, and Delete shortcuts for selected tasks in App.tsx. 87/87 tests, tsc and vite build pass.

### Git Commits

| Hash | Message |
|------|---------|
| `30ddea3` | feat: add Microsoft To Do-style task context menu and keyboard shortcuts |
| `d26105a` | docs(spec): document task context menu and keyboard shortcuts |

### Status

[OK] **Completed**


## Session 8: TaskDetail polish, inline input focus, and planned/completed alignment
<!-- trellis-session: v=2 fp=345a2ab7c05afa81 -->

**Date**: 2026-11-27
**Task**: TaskDetail polish, inline input focus, and planned/completed alignment
**Branch**: `master`

### Summary

Aligned TaskDetail layout, step menu, and dynamic 添加步骤/下一步 UX with Microsoft To Do; removed double blue focus borders across inline/form inputs; hid Completed sidebar count badge and excluded completed tasks from Planned date buckets.

### Main Changes

- TaskDetail: top-right close bar, circular step checks aligned with title checkbox, portaled ⋮ step menu (complete/promote/delete), dynamic 添加步骤/下一步 input with hover pill, active My Day + muted past reminders, centered footer
- CSS: unified single-layer Fluent focus styles across inline rename, step, tag, date-picker, and settings inputs
- Sidebar & Views: hid Completed count badge and filtered completed tasks out of Planned date buckets so 已逾期 matches sidebar count

### Git Commits

| Hash | Message |
|------|---------|
| `ba9be11` | feat: align task detail panel, inline inputs, and planned/completed views |
| `48462b0` | docs(spec): update TaskDetail, focus ring, and planned/completed guidelines |
| `cf0feb2` | chore(task): archive 11-27-task-detail-polish |

### Testing

- [OK] tsc --noEmit (0 errors), vitest run (11 files / 87 tests passed), npm run build (succeeded)

### Status

[OK] **Completed**


## Session 9: Task list alignment and flyout submenu viewport clamping
<!-- trellis-session: v=2 fp=8b876bb41faad5e8 -->

**Date**: 2026-11-27
**Task**: Task list alignment and flyout submenu viewport clamping
**Branch**: `master`

### Summary

Aligned TaskRow 2-line card layout, middle-dot metadata, overdue recurring amber bottom bar, section pills, and 40px page margins with Microsoft To Do; fixed bottom viewport clipping on task and sidebar flyout submenus.

### Main Changes

- TaskRow & dates.ts: crisp 52px 2-line cards, clean empty checkbox for incomplete tasks, middle-dot metadata order (My Day, emoji list name, 第 X 步，共 Y 步, compact dueDateLabel + repeat icon, reminder date, attachments, NoteIcon instead of note preview), amber bottom bar on overdue recurring tasks
- MainPane & CSS: unified 40px horizontal column across header/list/QuickAdd and tightened 30px translucent section pills
- TaskContextMenu & Sidebar: useLayoutEffect viewport clamping so move-to-list and move-to-group submenus shift upward when near the bottom edge

### Git Commits

| Hash | Message |
|------|---------|
| `088651e` | feat: align task row layout with Microsoft To Do and clamp flyout submenus |
| `754b688` | docs(spec): update TaskRow layout and unified 40px list column guidelines |
| `d33066f` | chore(task): archive 11-27-task-list-submenu-polish |

### Testing

- [OK] tsc --noEmit (0 errors), vitest run (11 files / 87 tests passed), npm run build (succeeded)

### Status

[OK] **Completed**


## Session 10: Suggestion panel polish and seamless return from TaskDetail
<!-- trellis-session: v=2 fp=b86b87d5ed3b84fb -->

**Date**: 2026-11-27
**Task**: Suggestion panel polish and seamless return from TaskDetail
**Branch**: `master`

### Summary

Removed count badge from SuggestionPanel header, aligned suggestion row step/date formatting, and made closing a TaskDetail opened from Suggestions return seamlessly to Suggestions with zero layout shift.

### Main Changes

- SuggestionPanel: removed N 项 header count badge and aligned step/date metadata formatting with TaskRow
- MainPane & CSS: unified SuggestionPanel width with --detail-w (375px), swapped Detail <-> Suggestions synchronously in the same render frame, and skipped slideIn animation when returning from Detail

### Git Commits

| Hash | Message |
|------|---------|
| `1b815b8` | fix: refine suggestion panel header and seamless return from task detail |

### Testing

- [OK] tsc --noEmit (0 errors), vitest run (11 files / 87 tests passed), npm run build (succeeded)

### Status

[OK] **Completed**


## Session 11: Dark mode theme adaptation and 14 CC0 photographic wallpapers
<!-- trellis-session: v=2 fp=69e7919b82da9516 -->

**Date**: 2026-11-27
**Task**: Dark mode theme adaptation and 14 CC0 photographic wallpapers
**Branch**: `master`

### Summary

Adapted dark mode for photo themes (dark frosted pills/QuickAdd, neutral slate #94a1ac accent, dark --on-accent checkmarks, neutral selected row) and pure color themes (Microsoft To Do dark canvas + accent foreground); fixed ghost checkmarks in TaskDetail; added notes-only label; upgraded 8 SVG presets to 14 curated CC0 photographic wallpapers.

### Main Changes

- Dark mode photo themes: dark frosted section pills and QuickAdd on .main.on-photo, neutral slate #94a1ac accent with --on-accent #1f1f1f checkmarks, neutral #3b3a39 selected card, and theme-accent TaskDetail rows
- Dark mode color themes (.main.on-color): keep calm #1f1f1f canvas and render color theme as foreground accent on title, subtitle, empty state, QuickAdd trigger, and welcome controls; dark empty-paper illustration
- TaskDetail & TaskRow: fixed unchecked ghost checkmarks on .detail-checkbox/.step-check in dark mode; rendered 备注 label when notes is the only TaskRow metadata item
- Wallpapers: replaced 8 SVG backgrounds with 14 visually verified 1600x960 CC0 photographs (2.81 MB total, keeping all 8 original preset IDs plus 6 new scenic themes)

### Git Commits

| Hash | Message |
|------|---------|
| `037a82a` | feat: adapt dark mode themes and upgrade to 14 CC0 photographic wallpapers |
| `b05e4d2` | docs(spec): document dark-mode color themes, slate photo accent, and notes label |
| `00a9c42` | chore(task): archive 11-27-dark-mode-and-wallpapers |

### Testing

- [OK] tsc --noEmit (0 errors), vitest run (11 files / 87 tests passed), npm run build (succeeded)

### Status

[OK] **Completed**


## Session 12: v0.1.0 release prep, multi-platform CI/CD, bilingual docs, and full-bleed icons
<!-- trellis-session: v=2 fp=3857de9dabbba3e7 -->

**Date**: 2026-11-27
**Task**: v0.1.0 release prep, multi-platform CI/CD, bilingual docs, and full-bleed icons
**Branch**: `master`

### Summary

Prepared v0.1.0 release infrastructure: Vite __APP_VERSION__ injection, bump-version script, cross-platform NSIS/macOS/Linux bundle config and attachment_reveal, GitHub Actions CI & Release CD, issue templates, bilingual README + CHANGELOG, SettingsPage direct changelog/bug/feature links, and tightened 96% fill app icons.

### Main Changes

- Release engineering: vite.config.ts __APP_VERSION__ injection, scripts/bump-version.mjs, tauri.conf.json targets=all + SimpChinese NSIS installer, macOS/Linux attachment_reveal in storage.rs
- CI/CD & community: .github/workflows/ci.yml (frontend + 3-OS cargo check), .github/workflows/release.yml (Windows NSIS + portable zip, macOS arm64/x64 DMG, Linux AppImage/DEB + SHA256SUMS), and Chinese bug/feature issue templates
- Docs & Settings: bilingual README.md / README.zh-CN.md, CHANGELOG.md, and SettingsPage About links (CHANGELOG, bug report, feature request) + cross-platform system theme label
- Icons: cropped excessive transparent padding from 79% to 96% width fill and regenerated public/logo.png + all src-tauri/icons assets via tauri icon

### Git Commits

| Hash | Message |
|------|---------|
| `b2a060d` | chore(release): prepare v0.1.0 CI/CD, bilingual docs, cross-platform config, and full-bleed app icons |
| `7925327` | chore(task): archive 11-27-v010-release-prep |

### Testing

- [OK] tsc --noEmit (0 errors), vitest run (11 files / 87 tests passed), npm run build (succeeded), cargo check (0 warnings)

### Status

[OK] **Completed**
