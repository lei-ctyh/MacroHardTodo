# Frontend Development Guidelines

> Conventions for the MacroHard Todo desktop frontend (React 18 + TypeScript + Tauri 2).

---

## Stack

- React 18 function components, Vite, Zustand, dnd-kit, date-fns, react-day-picker, lucide-react
- Tauri 2 (WebView2) shell; OS, file, WebDAV and Graph work goes through Rust commands
- One global stylesheet with design tokens: `src/styles.css` (no CSS-in-JS, no Tailwind classes in markup — Tailwind is only imported for reset/utilities)

---

## Pre-Development Checklist

- Read `src/lib/model.ts` (data shapes) and `src/store/useStore.ts` (mutations) before adding a field or action.
- Decide whether the state is **persisted/synced** (goes into `DB`) or **local UI state** (stays in the component).
- Search `src/lib/` for an existing pure helper before writing new logic (`merge.ts`, `recurrence.ts`, `views.ts`, `themes.ts`, `graphImport.ts`, `syncClient.ts`).
- If data is synced, update `mergeDB`/`fingerprint` semantics and add a Vitest case.
- Check whether the change also needs a Rust command (`src-tauri/src/*.rs`) and a typed wrapper in `src/lib/api.ts`.

---

## Quality Check

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- Unit tests: `node node_modules/vitest/vitest.mjs run`
- Rust: `cargo check` from `src-tauri`
- Manual: `npm run tauri dev` (hot reload) for Tauri APIs; `npm run dev` + a browser for pure UI work
- UI regression: when automation is needed, drive the app through Chrome DevTools Protocol on `127.0.0.1:9222`; keep temporary scripts, screenshots and test data under the project's gitignored `.test-artifacts/`, never in directories outside the repo

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Effects, selectors, async patterns | Filled |
| [State Management](./state-management.md) | Zustand store, DB document, persistence | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Commands, testing, forbidden patterns | Filled |
| [Type Safety](./type-safety.md) | Type organization, validation, casts | Filled |
