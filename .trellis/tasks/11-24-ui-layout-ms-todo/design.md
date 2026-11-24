# Design — Align UI layout with Microsoft To Do

## Boundaries

Frontend-only change. No Rust commands, no storage format changes beyond an optional local setting. Files touched:

- `src/lib/model.ts` — sort types + default setting
- `src/lib/views.ts` — sort helpers
- `src/store/useStore.ts` — `setSort` action
- `src/components/Sidebar.tsx` — sidebar search, remove per-list menu, new-list trigger
- `src/components/MainPane.tsx` — header actions, menu, inline rename, sort application
- `src/components/ViewMenu.tsx` — new top-right menu component
- `src/components/ThemePicker.tsx` — list color section
- `src/styles.css` — sidebar search, menu/rename styles, dead-rule cleanup
- `tests/sort.test.ts` — new sort unit tests

## Data Contracts

```ts
// model.ts
export type SortKey = "manual" | "importance" | "due" | "added" | "alpha";

export interface Settings {
  // existing fields…
  sortBy?: Record<string, SortKey>; // key: `list:<id>` | `smart:<id>`
}

export const DEFAULT_SETTINGS: Settings = {
  // existing fields…
  sortBy: {},
};
```

```ts
// views.ts
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "importance", label: "重要" },
  { key: "due", label: "截止日期" },
  { key: "added", label: "已添加" },
  { key: "alpha", label: "字母顺序" },
  { key: "manual", label: "我的顺序" },
];

export function viewKey(view: View): string;
export function sortTasks(tasks: Task[], sort: SortKey): Task[];
```

`sortTasks` is stable and returns a new array; ties fall back to the incoming index (the view's base order from `tasksForView`).

| Sort | Comparator |
|---|---|
| `manual` | unchanged (base order) |
| `importance` | `importance === "high"` first |
| `due` | `dueDate` asc, empty last; then `dueTime` asc, empty last |
| `added` | `createdAt` asc (oldest first) |
| `alpha` | `title.localeCompare(title, "zh-CN", { sensitivity: "base", numeric: true })` |

Store action:

```ts
setSort: (key: string, sort: SortKey) => void;
// updateSettings({ sortBy: { ...db.settings.sortBy, [key]: sort } })
```

Settings are local-only in `mergeDB` (`settings: local.settings`), so sort choice never syncs or conflicts across devices.

Theme targets generalize to every view:

```ts
export type ThemeTarget =
  | { type: "list"; list: TaskList }
  | { type: "smart"; id: SmartViewId };

// themes.ts
export function smartThemeKey(id: SmartViewId): string; // "mydayTheme" for myday, else `theme:${id}`
export function smartTheme(db: DB, id: SmartViewId): ListTheme | undefined;
```

- List themes stay on `list.theme`.
- Smart-view themes live in `db.shared[smartThemeKey(id)]` (`mydayTheme` is kept for the existing My Day theme; others use `theme:<id>`).
- `MainPane.themeTarget` is non-null for every view, so the menu always offers 主题.
- `ThemePicker` applies list/custom image/emoji the same way; the 列表颜色 section remains list-only.

## Data Flow

1. `MainPane` reads `view`, computes `sort = db.settings.sortBy?.[viewKey(view)] ?? "manual"`.
2. `allForView = tasksForView(db, view)` (existing base order).
3. `sorted = sortTasks(allForView, sort)`.
4. `visible = searchTasks(sorted, query)`.
5. Drag is enabled only when `view.type === "list" && !query.trim() && sort === "manual"`.
6. Sort selection calls `setSort(viewKey(view), key)`, which updates settings and saves immediately.

## Component Design

### Sidebar

- New `.sidebar-search` block directly under `.brand`: `SearchIcon` + input bound to `query` / `setQuery`; always rendered.
- Escape clears the query and blurs; an empty query shows all tasks in the view.
- Remove the `+` from the "列表" section header (section becomes a plain label).
- Add a "新建列表" action at the bottom of the sidebar (above 同步/设置). It sets the existing `adding` state; the inline name input stays at the end of the list section and scrolls into view when opened.
- Delete `SortableListRow`'s `...` menu, menu state, `LIST_COLORS` palette, rename and delete handlers. Keep drag-and-drop and the emoji/color-dot icon.
- `LIST_COLORS` import moves to `ThemePicker`.

### MainPane header

- Remove `searchOpen` state, the search icon/box, and the palette icon.
- Header actions:
  - My Day: suggestion (lightbulb) button + menu button.
  - Other views: menu button only.
- Menu button uses `MoreIcon` inside a `position: relative` wrapper; opens `ViewMenu` anchored below/right.

### ViewMenu (new component)

Props: `view`, `list` (when list view), `sort`, callbacks `onSort`, `onRename`, `onTheme`, `onDelete`, `canDelete`, `onClose`.

```
List view:   重命名 / 主题 / 排序依据 ▸ / 删除列表
Smart view:  主题 / 排序依据 ▸
```

- "排序依据" expands inline (accordion) with the five options and a check on the active one.
- Close on: outside `mousedown`, Escape, selecting a non-sort action, or selecting a sort option.
- Reuse `.menu` styles; add `.menu-wrap` for positioning and `.menu button.active` for the checked sort.

### Rename

- `MainPane` keeps `renaming` state. On "重命名", replace the title text with an autofocused input.
- Enter or blur commits via `renameList(id, value)`; Escape or an empty value cancels.
- No modal, no sidebar involvement.

### Theme

- Menu "主题" opens the existing `ThemePicker` modal on every view.
- `ThemePicker` accepts list targets and smart targets (`myday`, `important`, `planned`, `tasks`, `completed`); smart themes are stored through `setShared(smartThemeKey(id), …)`.
- `ThemePicker` adds a "列表颜色" section for list targets only (10 `LIST_COLORS` swatches, active ring). Clicking calls `setListColor` immediately.
- Section order for lists: 颜色 → 图标（emoji）→ 背景; smart views show 图标（emoji）→ 背景.

### Styles

- `.sidebar-search`: margin around the existing `.search-box` look; white input on the gray sidebar.
- `.main-menu` / `.menu-wrap`: relative anchor; menu right-aligned.
- `.main-title input`: title-sized inline input.
- Remove `.nav-more` rules if no longer referenced. Keep `.palette` (reused by ThemePicker).

## List Groups

### Data Model

```ts
// model.ts
export interface TaskGroup {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
  sourceId?: string;
}

export interface TaskList {
  // existing fields…
  groupId?: string; // undefined = ungrouped
}

export interface DB {
  // existing fields…
  groups: TaskGroup[];
}

export const DEFAULT_SETTINGS: Settings = {
  // existing fields…
  collapsedGroups: string[], // local-only UI state
};

export function activeGroups(db: DB): TaskGroup[];
```

- `createDB` seeds `groups: []`.
- `normalizeDb` defaults missing `groups` to `[]` and keeps `groupId` as-is.
- `activeGroups` filters `deletedAt` and sorts by `order`, then `id`.

### Merge / Sync

- `mergeDB` merges groups with the existing generic `mergeEntities` + `purgeTombstones` + `sortByOrder`, exactly like lists.
- `fingerprint` includes groups sorted by id so sync change detection covers group edits.
- Deleting a group tombstones the group and, in the same commit, sets `groupId: undefined` on its non-deleted lists (touching `updatedAt`), appending them to the end of the ungrouped section in their previous group order.
- If a remote group tombstone arrives before the list updates, rendering treats a missing/deleted group as ungrouped.

### Store Actions

```ts
addGroup: (name?: string) => string;                 // default "未命名的组"
renameGroup: (id: string, name: string) => void;
deleteGroup: (id: string) => void;                   // keeps lists, clears groupId
reorganizeLists: (entries: { id: string; groupId?: string }[]) => void;
toggleGroupCollapsed: (id: string) => void;          // settings.collapsedGroups
```

- `reorganizeLists` assigns `order` sequentially across the flattened sidebar order and updates `groupId` in one commit; this is the single entry point for drag-and-drop moves.
- `addList` stays ungrouped for the bottom "新建列表" action.

### Sidebar Structure

```
brand
search
smart views
ungrouped lists        (if any)
group header 1         (chevron + name + hover menu, droppable)
  list rows
group header 2
  list rows
inline new-list input
footer: [ + 新建列表 ][ □+ 创建新组 ]
        [ 同步 ]
        [ 设置 ]
```

- New component `GroupRow.tsx`: chevron toggles collapse, name double-click enters rename, hover `MoreIcon` opens a small menu (重命名 / 删除组).
- Creating a group calls `addGroup()`, expands it, and immediately enters inline rename with the default name selected; empty input keeps "未命名的组".
- Collapsed groups hide their list rows but remain droppable targets.
- Lists keep the existing `SortableListRow` rendering, indented under the group header.
- The bottom "新建列表" opens the existing inline input at the end of the ungrouped section.
- "创建新组" is an icon-only button (`SquarePlus` from lucide, added to `icons.tsx`) with tooltip.

### Drag and Drop

- One `DndContext` for the whole sidebar.
- Each section (ungrouped + every group) has its own `SortableContext`; sections also expose a droppable id `group:<id>` (ungrouped uses `group:ungrouped`) so empty/collapsed groups can receive drops.
- On drag end:
  - `over.id` is a list id → target group is that list's `groupId`, insert at that list's index.
  - `over.id` is `group:<id>` → target group is `<id>`, append.
  - Remove the active list from its source section, insert into the target section, flatten the sections, and call `reorganizeLists`.
- Group headers themselves are not draggable in this iteration (group order = creation order).
- Visual feedback: highlight the target section while dragging over it.

### Styles

- `.group-row`, `.group-caret`, `.group-name`, `.group-actions`, `.group-lists`, `.group-drop-target`.
- `.sidebar-new-row` for the footer pair; the new-list button flexes, the group button stays icon-sized.
- Reuse `.menu` for the group action menu.

### Tests

- Extend `tests/merge.test.ts` with group LWW, tombstone purge, and list `groupId` preservation.
- Add a pure helper test if grouping/flattening logic is extracted (e.g. `buildSections`).
- Manual checks: create/rename/collapse/delete group, drag list into/out of/between groups, restart persistence, WebDAV round-trip.

### Account Menu

- Wrap `.brand` in a `.brand-wrap` (position relative) and make the brand row a button (`aria-haspopup="menu"`, `aria-expanded`).
- Clicking toggles a dropdown below the brand using the existing `.menu` styles; it closes on outside mousedown, Escape, or selecting an item.
- Menu content:
  - A non-interactive header with the app name and sync status summary.
  - 同步 (CloudIcon): opens the existing sync dialog; shows `未配置` / `未同步` / last sync time / `正在同步` (spinner) / error text.
  - 设置 (SettingsIcon): opens the existing settings dialog.
- Remove the 同步/设置 rows from `.sidebar-footer`; the footer keeps only `.sidebar-new-row` (`新建列表` + `创建新组`).
- Keep the small `.brand-sync` status dot next to the brand name.

## Resizable Sidebar

- Add `Settings.sidebarWidth?: number` (default 240) — a local-only device preference, like other settings.
- `App.tsx` renders a `.sidebar-resizer` between `Sidebar` and `MainPane`.
- The app-shell receives an inline `--sidebar-w: <width>px`; the sidebar keeps `flex: 0 0 var(--sidebar-w)`.
- On pointer down, record `startX`/`startWidth`; on pointer move, set the width to `clamp(200, 420, startWidth + delta)`; on pointer up, persist via `updateSettings({ sidebarWidth })` and restore cursor/user-select.
- Double-click resets to 240px and persists.
- `.sidebar-resizer` is a 5px wide column-resize hit area straddling the sidebar border, with a subtle hover/active line.

## Nav Highlight Metrics (Microsoft-matched)

- `.sidebar-scroll` horizontal padding 6px; highlight inset `2px 0` → 36px tall, 6px side gaps.
- Highlight radius 3px, selected `#E9E9E9`, hover `#ECECEC`.
- Accent bar: `left: 1px` inside the highlight, 3×16px, radius 2px, `#005FB8`.
- Nav content padding-left 12px → icons start ~18px from the sidebar edge.

## Native Title Bar (Windows DWM)

- Microsoft To Do extends its client area into the title bar; Tauri keeps the native frame, so use DWM instead.
- `src-tauri/src/lib.rs` declares `DwmSetWindowAttribute` from `dwmapi` and applies:
  - `DWMWA_CAPTION_COLOR` (35) = `0x00F3F3F3` (`#F3F3F3`) light / `0x00232425` (`#252423`) dark (COLORREF is `0x00BBGGRR`).
  - `DWMWA_TEXT_COLOR` (36) = `0x00202020` light / `0x00F1F2F1` dark.
- The `set_titlebar_theme(dark)` Tauri command is registered and called by the frontend theme effect; `setup` applies the light default immediately so the first paint is close.
- Non-Windows targets compile to a no-op. Native caption buttons, drag, snap, and accessibility remain untouched (unlike a custom title bar).

## Trade-offs

- Inline accordion for sorting instead of a flyout submenu: fewer positioning bugs, slightly taller menu. Acceptable for five options.
- Sort stored in local settings instead of a new synced entity: sort is a per-device presentation choice; avoids merge complexity.
- List color stays a separate `TaskList.color` field (not merged into `theme`): keeps the change frontend-only and avoids touching merge semantics; the UI still presents color inside the theme dialog.
- Removing the sidebar per-list menu reduces duplicated actions but makes the top-right menu the only list-management entry; the menu is present on every list view, so discoverability is preserved.
- Groups keep creation order in this iteration; drag-reordering groups would require a second nested sortable layer and is deferred.
- Collapse state lives in local settings (`settings.collapsedGroups`), not synced, because it is a per-device view preference.
- Deleting a group keeps its lists and tasks (explicit product decision), which is safer than Microsoft To Do's delete-with-lists behavior.

## Compatibility / Rollout

- No release tag exists; no migration is required. `normalizeDb` already spreads `DEFAULT_SETTINGS`, so old data without `sortBy` reads as `{}`.
- All other changes are presentation-only; existing task/list/theme data remains valid.
- Rollback: revert the frontend files; the only persisted addition is an optional `settings.sortBy` object that older code ignores.

## Manual Verification

1. Sidebar search filters the current view; Escape clears; switching views clears.
2. Every view has one menu; list menu shows rename/theme/sort/delete; My Day shows theme/sort plus the suggestion button; other smart views show sort only.
3. Each sort option reorders correctly; choice persists after switching views and restarting the app.
4. Drag works only under 我的顺序; it is disabled for other sorts and during search.
5. Rename commits/cancels correctly; delete switches lists; last list cannot be deleted.
6. Theme is reachable on every view and persists per view; list color only appears for lists; sidebar icon updates.
7. My Day suggestions still open/close.
