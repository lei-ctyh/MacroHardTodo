# State Management

> How state is managed in this project.

---

## Overview

A single Zustand store (`src/store/useStore.ts`) owns the whole application document. The persisted unit is one JSON document (`DB`) written by a Rust command; the same document is the sync unit for WebDAV.

```ts
type DB = {
  schemaVersion: 1;
  deviceId: string;
  lists: TaskList[];
  groups: TaskGroup[];
  tasks: Task[];
  shared: Record<string, { value: unknown; updatedAt: number; updatedBy: string }>;
  settings: Settings; // local only, not synced
};
```

---

## State Categories

| Category | Where | Synced |
|---|---|---|
| Lists, tasks, steps, attachments | `db.lists` / `db.tasks` | Yes (entity LWW merge) |
| List groups | `db.groups`, referenced by `TaskList.groupId` | Yes (entity LWW merge + tombstones) |
| Cross-device preferences (view themes for My Day and other smart views) | `db.shared[key]` | Yes (per-key LWW) |
| Device/UI preferences (theme mode, purge days, WebDAV config, per-view sort, collapsed groups, sidebar width) | `db.settings` | No |
| Transient UI (search open, suggestion panel, editors, dialogs) | component `useState` | No |
| Current view / selected task / query | store (`view`, `selectedTaskId`, `query`) | No |

---

## Mutation Contract

Every persisted change goes through `commit`:

```ts
const commit = (fn: (db: DB) => DB, immediate = false) => {
  const next = fn(get().db);
  set({ db: next });
  schedule(next, immediate); // 300 ms debounce → save_db
};
```

- Never mutate objects in place. Return new arrays/objects (`map`, spreads).
- Every entity write must bump `updatedAt`/`updatedBy` via `touch(deviceId)`. This drives sync merge, not wall-clock ordering.
- Deletes are **soft deletes** (`deletedAt`), kept as tombstones for 60 days by `mergeDB`.
- Groups follow the same entity rules as lists. `deleteGroup` tombstones the group and clears `groupId` on its lists **in the same commit** so other devices never lose the lists.
- `reorganizeLists(entries)` is the single entry point for sidebar drag-and-drop: it assigns sequential `order` values and `groupId` across the flattened section order in one commit.
- Repeated tasks: on completion, `buildNextTask` creates the next instance; duplicates are deduped by `occurrenceKey` in `merge.ts`.
- `replaceDb` is reserved for sync/import/restore; it persists immediately.

---

## Derived State

Compute, never store:

- Views/counts/suggestions: `src/lib/views.ts` (`tasksForView`, `smartCounts`, `myDaySuggestionGroups`).
- Sort order: `sortTasks(tasks, sort)` in `src/lib/views.ts`, keyed per view with `viewKey(view)` and stored in `settings.sortBy`.
- Sidebar sections: `listSections(lists, groups)` and `moveList(sections, activeId, overId)` in `src/lib/views.ts`; rendering computes them with `useMemo`, never stores them.
- Due labels: `src/lib/dates.ts`.
- Merge outcome / fingerprint: `src/lib/merge.ts`.

Components call these inside `useMemo` keyed by `db` and the relevant view.

---

## Persistence and Sync

- Save pipeline: Zustand → `api.saveDb` (Rust atomic write + daily backup in `storage.rs`); browser fallback uses `localStorage` only when Tauri is unavailable.
- Sync pipeline: `syncNow` → `doSync` (download → `mergeDB` → optional encrypted upload) → `replaceDb`.
- WebDAV credentials/passphrase are stored in Windows Credential Manager, never in `DB`.
- Attachment/theme binaries upload after the main document; missing files are downloaded lazily by `ensureAttachment`.

---

## Common Mistakes

- Mutating `db` directly (React may not re-render; sync fingerprints miss changes).
- Forgetting `touch` → remote devices keep the older value.
- Removing a group by only deleting its entity without clearing `TaskList.groupId`; lists would point at a tombstone (the UI treats them as ungrouped, but the stale id keeps syncing).
- Bypassing `reorganizeLists` when moving lists between groups, which leaves duplicate `order` values.
- Storing derived data (counts, filtered lists) in the DB.
- Persisting secrets or WebDAV config into `db.shared` (would sync credentials).
- Calling `commit` inside an effect that depends on `db` → infinite save loop.
