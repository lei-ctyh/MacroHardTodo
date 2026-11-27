# Directory Structure

> How frontend code is organized in this project.

---

## Directory Layout

```
MacroHardTodo/
├── src/
│   ├── App.tsx               app shell, theme/reminder/sync effects, dialog switching
│   ├── main.tsx              React root
│   ├── styles.css            single stylesheet + design tokens
│   ├── components/           UI components (PascalCase .tsx)
│   │   ├── Sidebar.tsx
│   │   ├── MainPane.tsx      header, task list, bottom QuickAdd, theme background
│   │   ├── ViewMenu.tsx      top-right menu (sort flyout, theme grid/upload, list colors, actions)
│   │   ├── GroupRow.tsx      sidebar group header (collapse, inline rename, hover menu, droppable)
│   │   ├── SectionHeader.tsx view-level section header (task-list/date groups, completed area)
│   │   ├── TaskRow.tsx
│   │   ├── TaskContextMenu.tsx portaled right-click menu on task rows (My Day, star, complete, due date, move-to-list flyout, delete)
│   │   ├── TaskDetail.tsx    right-side detail panel (card sections, reminder/due/repeat menus, overdue cleanup)
│   │   ├── DateTimePicker.tsx custom date/time picker backed by react-day-picker
│   │   ├── RepeatDialog.tsx  narrow modal custom recurrence editor with portaled popovers
│   │   ├── QuickAdd.tsx      fixed bottom add bar
│   │   ├── SuggestionPanel.tsx
│   │   ├── SettingsPage.tsx  full-window settings page (general, theme, smart lists, sync & data, about)
│   │   ├── ToggleSwitch.tsx  shared Fluent pill switch (SettingsPage, SyncDialog)
│   │   ├── ConfirmDialog.tsx narrow confirmation modal driven by confirmBeforeDelete
│   │   ├── useAvatar.ts      shared avatar loading/picking hook for Sidebar and SettingsPage
│   │   ├── SyncDialog.tsx / MigrationWizard.tsx
│   │   ├── Modal.tsx         shared dialog shell (supports wide / narrow)
│   │   └── icons.tsx         central lucide re-exports (never import lucide elsewhere)
│   ├── lib/                  pure TypeScript domain logic (no React imports)
│   │   ├── model.ts          DB/Task/TaskList/TaskGroup/Step/Theme types + factories
│   │   ├── merge.ts          per-entity LWW merge, tombstones, dedupe (lists, groups, tasks)
│   │   ├── recurrence.ts     next-occurrence rules (with anchor day/month), catch-up, buildNextTask
│   │   ├── views.ts          smart views, per-view sorting, counts, suggestion groups, sidebar sections, view-level task grouping
│   │   ├── dates.ts          date formatting helpers (dueLabel, dayLabel, reminderLabel)
│   │   ├── emoji.ts          leading-emoji grapheme splitting for custom list names
│   │   ├── sound.ts          Web Audio API completion chime (no external audio assets)
│   │   ├── themes.ts         preset backgrounds, theme image resolution
│   │   ├── graphImport.ts    Microsoft Graph mapping + idempotent import
│   │   ├── syncClient.ts     WebDAV sync orchestration (merge + upload)
│   │   ├── api.ts            typed wrappers around Tauri invoke commands
│   │   └── search.ts
│   └── store/
│       └── useStore.ts       Zustand store: all mutations + persistence
├── src-tauri/
│   ├── src/{lib,storage,sync,graph,secret,crypto}.rs
│   ├── capabilities/default.json
│   └── tauri.conf.json
├── public/backgrounds/*.svg  8 built-in theme backgrounds
├── tests/                    Vitest specs for pure lib code and store mutations
└── .trellis/                 Trellis workflow, spec, tasks
```

---

## Module Organization

- **Domain types** live only in `src/lib/model.ts`. Do not redeclare `Task`/`TaskList` shapes in components.
- **Pure logic** goes in `src/lib/*.ts`: no React, no Tauri `invoke`, no `window` access. This is what Vitest covers.
- **Mutations** go through store actions in `src/store/useStore.ts`. Components never construct a new `DB` themselves.
- **Tauri commands** are declared in Rust (`src-tauri/src/*.rs`), registered in `lib.rs`, and wrapped once in `src/lib/api.ts`. Components call the `api` object, never `invoke` directly.
- **UI components** own only local presentation state (open editors, search box, dialog visibility). Persisted/synced state belongs to the store.
- **Sync transport** (`webdav_*`, `graph_*`) lives in Rust; merge/import decisions stay in TypeScript so they are testable.
- **Sidebar grouping**: groups are synced entities (`DB.groups`); a list references one via `TaskList.groupId`. Pure section/drag logic lives in `views.ts` (`listSections`, `moveList`), rendering in `Sidebar.tsx` + `GroupRow.tsx`, mutations in the store.

---

## Naming Conventions

- Components: `PascalCase.tsx`, named export (`export function TaskRow`); only `App` is a default export.
- Lib modules: `camelCase.ts`, named exports.
- Store: single `useStore` hook.
- CSS: kebab-case classes in `styles.css`; state modifiers as classes (`.nav-item.active`, `.task-row.selected`).
- Data IDs: `uid("task"|"list"|"step"|"dev")` from `model.ts`.

---

## Examples

- Feature slice: `SuggestionPanel.tsx` (UI) + `myDaySuggestionGroups` in `views.ts` (logic) + `setMyDay` in `useStore` (mutation).
- Sync slice: `src-tauri/src/sync.rs` (transport) + `src/lib/syncClient.ts` (merge/upload) + `tests/merge.test.ts` (unit).
- Theme slice: `ViewMenu.tsx` (inline theme grid/upload/list colors, every view) + `themes.ts` (presets/resolution, `smartTheme`/`smartThemeKey`) + `TaskList.theme` / `DB.shared["mydayTheme"]` / `DB.shared["theme:<smartId>"]` (data).
