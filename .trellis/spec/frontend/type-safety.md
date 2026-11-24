# Type Safety

> Type safety patterns in this project.

---

## Overview

`tsconfig.json` runs with `strict: true`. TypeScript is the only static gate (no ESLint configured). Types are shared between UI, store, merge logic and sync; Rust returns JSON that is typed at the `api.ts` boundary.

---

## Type Organization

- **Domain types**: `src/lib/model.ts` (`DB`, `Task`, `TaskList`, `Step`, `Attachment`, `ListTheme`, `RecurrenceRule`, `Settings`). Single source of truth.
- **View union**: `View = { type: "smart"; id: SmartViewId } | { type: "list"; id: string }` in `src/lib/views.ts`.
- **Graph payloads**: `GraphTaskRaw`, `GraphListRaw`, `GraphDateTime` in `src/lib/graphImport.ts`; mapping functions narrow them.
- **API results**: `src/lib/api.ts` declares return types for every `invoke` (`LoadResult`, `WebdavDownloadResult`, `GraphTokenResult`, …).
- Local prop types stay inline in the component file.

---

## Validation

There is no Zod/Yup. Validation happens at trust boundaries:

- `normalizeDb()` in `useStore.ts` fills missing `lists`/`tasks`/`shared`/`settings` before use.
- `validateDB()` in `syncClient.ts` rejects remote payloads that are not a Todo document.
- `load_db` in Rust returns `{ db, path, warning }`; malformed JSON is backed up as `todo-data.corrupt-*.json` instead of crashing.
- Graph fields are accessed through optional chaining and defaults (`raw.importance === "high"`).

When adding a new persisted field, update `normalizeDb` (and `DEFAULT_SETTINGS`/factories) so old files still load.

---

## Common Patterns

- Patch objects: `updateTask(id, patch: Partial<Task>)`; the store adds `updatedAt`/`updatedBy`.
- Discriminated unions for views and theme targets (`ThemeTarget = { type: "list"; list } | { type: "myday" }`).
- `Record<string, T>` for keyed maps; convert arrays to `Map` for lookups in `useMemo`.
- Type guards at parse points: `typeof value === "string"`, `Array.isArray(...)`.
- Rust command args are camelCase from JS (`relPath`, `ifMatch`, `clientId`) and snake_case in Rust; serde renames where needed (`#[serde(rename_all = "camelCase")]`).

---

## Forbidden Patterns

- `any`. Use `unknown` + narrowing (Graph raw data is the exception: it is typed as a `Record<string, unknown>` and mapped once).
- Unsafe casts in component code. Casts are allowed only at boundaries, e.g. `page.items as unknown as GraphTaskRaw[]`.
- Non-null assertions (`!`) unless the invariant is obvious (e.g. `document.getElementById("root")!` in `main.tsx`).
- Re-declaring domain shapes in components instead of importing from `model.ts`.
- Adding a field to `Task` without updating merge/normalize/tests.
