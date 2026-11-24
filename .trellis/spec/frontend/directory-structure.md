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
│   │   ├── TaskRow.tsx
│   │   ├── TaskDetail.tsx    right-side detail panel
│   │   ├── QuickAdd.tsx      fixed bottom add bar
│   │   ├── SuggestionPanel.tsx
│   │   ├── ThemePicker.tsx
│   │   ├── SettingsDialog.tsx / SyncDialog.tsx / MigrationWizard.tsx
│   │   ├── Modal.tsx         shared dialog shell
│   │   └── icons.tsx         central lucide re-exports (never import lucide elsewhere)
│   ├── lib/                  pure TypeScript domain logic (no React imports)
│   │   ├── model.ts          DB/Task/TaskList/Step/Theme types + factories
│   │   ├── merge.ts          per-entity LWW merge, tombstones, dedupe
│   │   ├── recurrence.ts     next-occurrence rules, buildNextTask
│   │   ├── views.ts          smart views, counts, suggestion groups
│   │   ├── dates.ts          date formatting helpers
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
├── tests/                    Vitest specs for pure lib code
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
- Theme slice: `ThemePicker.tsx` (UI) + `themes.ts` (presets/resolution) + `TaskList.theme` / `DB.shared["mydayTheme"]` (data).
