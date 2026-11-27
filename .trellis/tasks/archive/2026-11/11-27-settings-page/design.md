# Design: Settings Page Redesign

## 1. Architecture & Boundaries

### Page-Level Navigation vs Modal Dialogs
- Previously `useStore.dialog` held `"settings" | "sync" | "migration" | null`, so opening Sync/Migration closed Settings.
- New separation in `src/store/useStore.ts`:
  - `settingsOpen: boolean` (`openSettings()`, `closeSettings()`) — full-window page state.
  - `dialog: "sync" | "migration" | null` (`openDialog(...)`) — modal dialogs that can overlay either the main workspace or `SettingsPage`.
  - `confirm: ConfirmRequest | null` (`requestConfirm(...)`, `closeConfirm()`) — transient confirmation modal state for `confirmBeforeDelete`.
- In `src/App.tsx`:
  - When `settingsOpen` is `true`, render `<SettingsPage />` inside `.app-shell.settings-mode` (omitting `Sidebar`, `.sidebar-resizer`, `MainPane`, and `TaskDetail`), while keeping `<SyncDialog />`, `<MigrationWizard />`, `<ConfirmDialog />`, and the `loadWarning` banner mounted above it.
  - `Escape` handling priority: open `<Modal>` (handles its own Escape via `Modal.tsx`) → `sidebarOpen` → `settingsOpen` (`closeSettings()`) → `selectTask(null)`.
  - `focusQuickAdd()` closes `settingsOpen` if open so `Ctrl+N` / `Ctrl+Alt+T` immediately brings the user back to the workspace and focuses `QuickAdd`.

### New & Updated Files
- **New**:
  - `src/components/SettingsPage.tsx` — full-window settings view (replaces `SettingsDialog.tsx`).
  - `src/components/ConfirmDialog.tsx` — narrow confirmation `<Modal>` driven by `useStore.confirm`.
  - `src/lib/sound.ts` — pure browser Web Audio API completion chime (`playCompletionChime()`, safe no-op in headless/Node/restricted environments).
  - `src/lib/avatar.ts` (or small helper in `src/lib/themes.ts` / shared hook) — Actually, avatar loading (`api.attachmentRead`) + picking (`open` + `api.attachmentAdd`) is used in both `Sidebar.tsx` and `SettingsPage.tsx`; extract a clean shared React hook or keep pure image helpers in `src/lib/` + hook in `src/components/useAvatar.ts` (Wait: check `.trellis/spec/frontend/directory-structure.md` — `src/lib/` must have NO React imports! Putting `useAvatar` in `src/components/useAvatar.ts` or keeping `loadAvatarDataUrl` in `src/lib/themes.ts` honors the boundary cleanly).
- **Removed**:
  - `src/components/SettingsDialog.tsx` (replaced by `SettingsPage.tsx`).
- **Updated**:
  - `src/lib/model.ts` — extend `Settings` and `DEFAULT_SETTINGS`.
  - `src/lib/views.ts` — `isInMyDay`, `isSmartViewVisible`, update `tasksForView` / `completedTasksForView` / `smartCounts` / `myDaySuggestions` / `myDaySuggestionGroups`.
  - `src/store/useStore.ts` — `normalizeDb` nested defaults, `settingsOpen`, `confirm`, `addTask` top/bottom order, `toggleImportance` move-to-top, `toggleComplete` sound trigger, `setSmartListVisible` or view-fallback in `updateSettings`.
  - `src/App.tsx` — full-page switch, Escape/QuickAdd integration, mount `<ConfirmDialog />`.
  - `src/components/Sidebar.tsx` — open Settings via `openSettings()`, filter `SMART_ITEMS` with `isSmartViewVisible`, wrap list delete and empty-group delete with confirmation helper, share avatar URL resolution.
  - `src/components/MainPane.tsx` — wrap ViewMenu list delete with confirmation helper.
  - `src/components/TaskDetail.tsx` — wrap delete task button with confirmation helper; reflect `isInMyDay` accurately when task is auto-included via `dueDate === todayISO()`.
  - `src/components/DateTimePicker.tsx` — read `db.settings.weekStartsOn` instead of hardcoded `1`.
  - `src/styles.css` — full-page settings styles, Fluent toggle switch, vertical theme radio group, profile header, dark-mode tokens.

---

## 2. Data Model & Contracts

### `Settings` Extensions (`src/lib/model.ts`)
```ts
export type ToggleableSmartViewId = "important" | "planned" | "all" | "completed";

export interface Settings {
  // ...existing fields...
  addTasksOnTop: boolean;
  moveStarredToTop: boolean;
  playCompletionSound: boolean;
  confirmBeforeDelete: boolean;
  weekStartsOn: 0 | 1;
  smartListVisibility: Record<ToggleableSmartViewId, boolean>;
  autoHideEmptySmartLists: boolean;
  showDueTodayInMyDay: boolean;
}
```

### Defaults (`DEFAULT_SETTINGS`)
```ts
addTasksOnTop: true,
moveStarredToTop: true,
playCompletionSound: true,
confirmBeforeDelete: true,
weekStartsOn: 1,
smartListVisibility: {
  important: true,
  planned: true,
  all: true,
  completed: true,
},
autoHideEmptySmartLists: false,
showDueTodayInMyDay: true,
```

### Compatibility (`normalizeDb` in `useStore.ts`)
- Old `todo-data.json` files lack these fields.
- `normalizeDb` spreads `{ ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) }` AND explicitly merges nested `smartListVisibility`:
  ```ts
  smartListVisibility: {
    ...DEFAULT_SETTINGS.smartListVisibility,
    ...(raw.settings?.smartListVisibility ?? {}),
  },
  ```
- `weekStartsOn` is validated to `0 | 1` (fallback `1`).
- None of these fields are synced (they live inside local-only `db.settings`), so `mergeDB` and `fingerprint` require no sync schema bump.

---

## 3. Detailed Behavioral Contracts

### 3.1 `addTasksOnTop` (`useStore.addTask`)
- Compute orders of active tasks in `listId`: `const orders = activeTasks(db).filter((t) => t.listId === listId).map((t) => t.order);`
- If `orders.length === 0`: `order = 0`.
- Else if `db.settings.addTasksOnTop`: `order = Math.min(...orders) - 1`.
- Else: `order = Math.max(...orders) + 1`.
- Preserves existing manual sorting (`a.order - b.order`) and drag-and-drop (`reorderTasks` re-indexes `0..n-1`).

### 3.2 `moveStarredToTop` (`useStore.toggleImportance`)
- Inside `commit`: find the target task.
- If transitioning `normal` → `high` AND `db.settings.moveStarredToTop`:
  - Compute `minOrder` among active tasks in `task.listId` excluding `task.id`.
  - If `minOrder !== undefined && task.order >= minOrder`, set `order: minOrder - 1`.
- If transitioning `high` → `normal` or setting is `false`: keep `task.order` unchanged.
- Always bumps `updatedAt`/`updatedBy` via `touch(db.deviceId)`.

### 3.3 `playCompletionSound` (`src/lib/sound.ts` + `useStore.toggleComplete`)
- `playCompletionChime()` lazily creates/resumes a shared `AudioContext`, plays a subtle ~180ms two-note sine chime (e.g. C6 → E6 with soft attack and exponential decay at low gain ~0.12), and catches all errors silently.
- Triggered only inside `toggleComplete` when `!task.completed` and `db.settings.playCompletionSound` is `true`.

### 3.4 `confirmBeforeDelete` (`ConfirmDialog.tsx` + `useStore`)
- `ConfirmRequest`: `{ title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }`.
- Helper `confirmDelete(req)` on store (or `requestConfirm` checking `confirmBeforeDelete`):
  - If `get().db.settings.confirmBeforeDelete` is `false`, immediately calls `req.onConfirm()`.
  - If `true`, sets `confirm: req` to display `<ConfirmDialog />` (`<Modal narrow>`).
- Deletion call sites wired to `confirmDelete`:
  1. `TaskDetail.tsx` delete task button → title `"删除任务"`, message `"将永久删除“<title>”？"`
  2. `Sidebar.tsx` (`SortableListRow`) delete custom list → title `"删除列表"`, message `"将删除列表“<name>”，其中的任务会保留并移至「任务」清单。"`
  3. `MainPane.tsx` (`ViewMenu`) delete custom list → same message.
  4. `Sidebar.tsx` (`GroupRow`) delete empty group → title `"删除组"`, message `"将删除空分组“<name>”？"` (Note: non-empty group calls `deleteGroup` directly because the action is non-destructive 「取消分组列表」).
- Store mutation methods `deleteTask`, `deleteList`, `deleteGroup` remain direct synchronous mutations so unit tests remain fast and deterministic.

### 3.5 Smart List Visibility (`src/lib/views.ts` + `Sidebar.tsx`)
- `isSmartViewVisible(db: DB, id: ToggleableSmartViewId, counts: Record<SmartViewId, number>, activeView?: View): boolean`:
  - If `db.settings.smartListVisibility?.[id] === false`, return `false`.
  - If `db.settings.autoHideEmptySmartLists` and `(counts[id] ?? 0) === 0`:
    - Keep visible if `activeView?.type === "smart" && activeView.id === id` so the user is never abruptly kicked out while completing the last task in that view.
    - Otherwise return `false`.
  - Return `true`.
- When toggling a smart list OFF in `SettingsPage`, if current `view` matches that smart view, call `setView({ type: "smart", id: "myday" })`.

### 3.6 `showDueTodayInMyDay` (`src/lib/views.ts` + `TaskDetail.tsx`)
- Pure helper `isTaskInMyDay(task: Task, today: string, includeDueToday: boolean): boolean`:
  - `return task.myDay === today || (includeDueToday && task.dueDate === today);`
- Used consistently in:
  - `tasksForView` (`myday`)
  - `completedTasksForView` (`myday`)
  - `smartCounts` (`myday`)
  - `myDaySuggestions` (excludes tasks where `isTaskInMyDay` is true)
  - `myDaySuggestionGroups` (excludes tasks where `isTaskInMyDay` is true)
- In `TaskDetail.tsx`:
  - `const manuallyInMyDay = task.myDay === todayISO();`
  - `const autoInMyDay = !manuallyInMyDay && db.settings.showDueTodayInMyDay && task.dueDate === todayISO();`
  - If `manuallyInMyDay`: click removes (`setMyDay(task.id, null)`), label `"从我的一天移除"`.
  - If `autoInMyDay`: icon highlighted in accent, label `"已在“我的一天”（今天截止）"`, clicking pins `setMyDay(task.id, todayISO())` (or remains informative without breaking `dueDate`).
  - Otherwise: label `"添加到“我的一天”"`, clicking calls `setMyDay(task.id, todayISO())`.

### 3.7 `dataDir` Loading Fix (`SettingsPage.tsx`)
- State: `dataDirStatus: { state: "loading" } | { state: "ready"; path: string } | { state: "unavailable" }`.
- On mount, invoke `api.dataDir()`:
  - Non-empty string → `{ state: "ready", path }` (render monospace path + copy button).
  - Empty string or rejected promise → `{ state: "unavailable" }` (render `"浏览器本地存储（非桌面客户端环境）"`).

---

## 4. Trade-Offs & Rollback

- **Trade-off (Web Audio vs bundled WAV/MP3)**: Synthesizing a clean chime with Web Audio API avoids adding binary media assets, guarantees zero network/file I/O latency, and respects the project's no-Microsoft-assets rule.
- **Trade-off (`showDueTodayInMyDay` default ON)**: Existing unit tests in `tests/grouping.test.ts` use tasks without `dueDate` for the `myday` completed test, so all existing tests stay green while new tests explicitly verify both `true` and `false`.
- **Rollback**: All new settings live in local-only `DB.settings` and UI lives primarily in new `SettingsPage.tsx` / `ConfirmDialog.tsx` / `sound.ts`; reverting the commits cleanly restores the prior modal and behavior without corrupting `todo-data.json`.
